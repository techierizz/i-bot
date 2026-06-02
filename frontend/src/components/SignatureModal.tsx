import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Eraser } from "lucide-react";

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (signatureDataUrl: string) => void;
  userId: number;
}

export default function SignatureModal({ isOpen, onClose, onSaved, userId }: SignatureModalProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isSaving, setIsSaving] = useState(false);

  const clearCanvas = () => {
    sigCanvas.current?.clear();
  };

  const saveSignature = async () => {
    if (sigCanvas.current?.isEmpty()) {
      alert("Please draw a signature first.");
      return;
    }

    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
    if (!dataUrl || !userId) return;

    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:8000/api/user/${userId}/signature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signature_data: dataUrl }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Signature saved beautifully!");
        onSaved(dataUrl);
        onClose();
      } else {
        alert(data.detail || "Failed to save signature.");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
              <div>
                <h3 className="text-lg font-bold text-white">Digital Signature</h3>
                <p className="text-xs text-zinc-400">Sign below to authenticate your I-Card</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Canvas Area */}
            <div className="p-4 bg-zinc-800/50 flex flex-col items-center">
              <div className="w-full bg-white rounded-lg overflow-hidden border-2 border-dashed border-zinc-600 cursor-crosshair">
                <SignatureCanvas
                  ref={sigCanvas}
                  penColor="black"
                  canvasProps={{
                    className: "signature-canvas w-full h-48",
                  }}
                />
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
              <button
                onClick={clearCanvas}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors font-medium text-sm"
              >
                <Eraser className="w-4 h-4" />
                Clear
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSignature}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg transition-all font-bold text-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Signature
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
