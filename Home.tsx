
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import {GoogleGenAI} from '@google/genai';
import {
  ChevronDown,
  LoaderCircle,
  SendHorizontal,
  Trash2,
  X,
  Key,
  ExternalLink,
  Zap,
  RefreshCcw,
  Download,
  Mic,
  MicOff,
  ImagePlus,
} from 'lucide-react';
import React, {useEffect, useRef, useState} from 'react';

// Use a separate interface to avoid naming collisions and modifier mismatches
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // Fix: Unified declaration without optionality to match standard environment expectations
    aistudio: AIStudio;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function parseError(error: string) {
  const regex = /{"error":(.*)}/gm;
  const m = regex.exec(error);
  try {
    const e = m[1];
    const err = JSON.parse(e);
    return err.message || error;
  } catch (e) {
    return error;
  }
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundImageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-image');
  const [hasApiKey, setHasApiKey] = useState(true);
  
  // Usage tracking
  const [usageCount, setUsageCount] = useState(() => {
    const saved = localStorage.getItem('gemini_usage_count');
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    localStorage.setItem('gemini_usage_count', usageCount.toString());
  }, [usageCount]);

  // Check for API key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume the key selection was successful to avoid race conditions
      setHasApiKey(true);
    }
  };

  const resetUsage = () => {
    setUsageCount(0);
  };

  // Voice to Text logic (Bahasa Melayu KL)
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser anda tidak menyokong pengecaman suara.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ms-MY'; // Bahasa Melayu Malaysia
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setPrompt(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Load background image
  useEffect(() => {
    if (generatedImage && canvasRef.current) {
      const img = new window.Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        drawImageToCanvas();
      };
      img.src = generatedImage;
    }
  }, [generatedImage]);

  useEffect(() => {
    if (canvasRef.current) {
      initializeCanvas();
    }
  }, []);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const drawImageToCanvas = () => {
    if (!canvasRef.current || !backgroundImageRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const img = backgroundImageRef.current;
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.width / img.height;
    
    let drawWidth, drawHeight, x, y;
    
    if (imgRatio > canvasRatio) {
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgRatio;
      x = 0;
      y = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = canvas.height * imgRatio;
      drawHeight = canvas.height;
      x = (canvas.width - drawWidth) / 2;
      y = 0;
    }
    
    ctx.drawImage(img, x, y, drawWidth, drawHeight);
  };

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return {x: 0, y: 0};
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const {x, y} = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const {x, y} = getCoordinates(e);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setGeneratedImage(null);
    backgroundImageRef.current = null;
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `gemini-drawing-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setGeneratedImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const openColorPicker = () => colorInputRef.current?.click();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    setIsLoading(true);

    try {
      const canvas = canvasRef.current;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error("Could not initialize context");

      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);

      const drawingData = tempCanvas.toDataURL('image/png').split(',')[1];
      // Create a fresh instance for every call
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          {
            parts: [
              {inlineData: {data: drawingData, mimeType: 'image/png'}},
              {text: `${prompt}. Keep the same minimal line drawing style.`}
            ]
          }
        ]
      });

      // Find the image part iterating through parts
      let imageBase64: string | undefined;
      for (const candidate of response.candidates || []) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            imageBase64 = part.inlineData.data;
            break;
          }
        }
        if (imageBase64) break;
      }

      if (imageBase64) {
        setGeneratedImage(`data:image/png;base64,${imageBase64}`);
        setUsageCount(prev => prev + 1);
      } else {
        throw new Error('Maaf, gambar tidak dapat dihasilkan. Cuba lagi.');
      }
    } catch (error: any) {
      console.error('Error:', error);
      // Reset key selection if entity not found (common for billing/key issues)
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
      }
      setErrorMessage(error.message || 'Ralat tidak dijangka berlaku.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen notebook-paper-bg text-gray-900 flex flex-col">
      {/* API Key Banner */}
      {!hasApiKey && (
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
            <Key className="w-4 h-4" />
            <span>Penghasilan berkualiti tinggi memerlukan API key berbayar.</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleOpenKeySelector}
              className="bg-amber-800 text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-amber-900 transition-colors flex items-center gap-2"
            >
              Pilih API Key
            </button>
            <a
              href="https://ai.google.dev/gemini-api/docs/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-700 underline flex items-center gap-1"
            >
              Dokumentasi <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      <main className="container mx-auto px-3 sm:px-6 py-5 sm:py-10 pb-32 max-w-5xl w-full flex-grow">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 sm:mb-6 gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold mb-0 leading-tight font-mega">
              Gemini Co-Drawing
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <p className="text-sm text-gray-500">
                Sintesis lakaran interaktif dengan{' '}
                <span className="font-semibold text-gray-700">Gemini 3 Pro</span>
              </p>
              
              <div className="flex items-center gap-1.5 bg-black text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
                <Zap className={`w-3 h-3 text-yellow-400 ${isLoading ? 'animate-pulse' : ''}`} />
                <span>Guna: {usageCount}</span>
                <button 
                  onClick={resetUsage}
                  title="Reset kaunter"
                  className="ml-1 hover:text-red-400 transition-colors"
                >
                  <RefreshCcw className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center bg-gray-200/50 rounded-full p-2 shadow-sm self-start sm:self-auto backdrop-blur-sm">
            <div className="relative mr-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="h-10 rounded-full bg-white pl-3 pr-8 text-sm text-gray-700 shadow-sm transition-all hover:bg-gray-50 appearance-none border-2 border-white"
                aria-label="Pilih Model">
                <option value="gemini-2.5-flash-image">2.5 Flash</option>
                <option value="gemini-3-pro-image-preview">3 Pro (HQ)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <button
              type="button"
              className="w-10 h-10 rounded-full overflow-hidden mr-2 flex items-center justify-center border-2 border-white shadow-sm transition-transform hover:scale-110"
              onClick={openColorPicker}
              style={{backgroundColor: penColor}}>
              <input
                ref={colorInputRef}
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
                className="opacity-0 absolute w-px h-px"
              />
            </button>
            <button
              type="button"
              onClick={triggerUpload}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 mr-2"
              title="Muat Naik Gambar">
              <ImagePlus className="w-5 h-5 text-gray-700" />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </button>
            <button
              type="button"
              onClick={saveCanvas}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 mr-2"
              title="Simpan PNG">
              <Download className="w-5 h-5 text-gray-700" />
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110">
              <Trash2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="w-full mb-6 relative">
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="border-4 border-black w-full hover:cursor-crosshair sm:h-[65vh] h-[40vh] bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] touch-none"
          />
          <div className="absolute bottom-[-16px] left-0 w-full h-1 bg-gray-200 overflow-hidden rounded-full border border-black/5">
             <div 
              className="h-full bg-black transition-all duration-500 ease-out" 
              style={{ width: `${Math.min(usageCount * 5, 100)}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full mt-8">
          <div className="relative flex items-center">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={isListening ? "Mendengar..." : "Ceritakan apa yang Gemini patut lukis..."}
              className={`w-full p-4 pr-28 text-sm sm:text-lg border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none transition-all font-mono ${isListening ? 'bg-red-50' : 'bg-white'}`}
              required
            />
            <div className="absolute right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                title="Guna suara (Bahasa Melayu)"
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="p-2 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 transition-colors"
              >
                {isLoading ? (
                  <LoaderCircle className="w-6 h-6 animate-spin" />
                ) : (
                  <SendHorizontal className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
          {isListening && (
            <p className="mt-2 text-xs text-red-500 font-bold animate-pulse">Sila bercakap sekarang... (Bahasa Melayu KL digalakkan)</p>
          )}
        </form>
      </main>

      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-md w-full p-8 relative">
            <button
              onClick={() => setShowErrorModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-black text-black mb-4 uppercase">Ralat</h3>
            <div className="font-mono text-sm text-gray-700 bg-gray-100 p-4 border-2 border-black/10">
              {parseError(errorMessage)}
            </div>
            <button
              onClick={() => setShowErrorModal(false)}
              className="mt-6 w-full py-3 bg-black text-white font-bold uppercase tracking-widest"
            >
              Faham
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
