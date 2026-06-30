import React, { useEffect, useState } from "react";
import { Download, RefreshCw, X, Sparkles, AlertCircle } from "lucide-react";
import { getApiUrl } from "../lib/api";

// Define the hardcoded current local app version
const LOCAL_APP_VERSION = "1.0.0"; 

interface UpdateInfo {
  version: string;
  downloadUrl: string;
  changelog?: string;
  forceUpdate?: boolean;
  publishedAt?: string;
}

/**
 * Robust version comparison utility
 * Returns true if serverVer is strictly greater than localVer
 */
function isNewerVersion(serverVer: string, localVer: string): boolean {
  const parse = (v: string) => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const serverParts = parse(serverVer);
  const localParts = parse(localVer);
  
  const maxLength = Math.max(serverParts.length, localParts.length);
  for (let i = 0; i < maxLength; i++) {
    const s = serverParts[i] || 0;
    const l = localParts[i] || 0;
    if (s > l) return true;
    if (s < l) return false;
  }
  return false;
}

export default function UpdateNotifier() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function checkForUpdates() {
      // Respect the user's choice: if they dismissed this exact version in this session/day, don't show it again (unless forceUpdate is active)
      try {
        setIsLoading(true);
        const response = await fetch(getApiUrl("/api/version/latest"));
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        
        const data: UpdateInfo = await response.json();
        if (data && data.version) {
          const hasUpdate = isNewerVersion(data.version, LOCAL_APP_VERSION);
          
          if (hasUpdate) {
            // Check if user dismissed this specific version earlier
            const dismissedVersion = localStorage.getItem("faso_educ_dismissed_update_version");
            
            if (data.forceUpdate || dismissedVersion !== data.version) {
              setUpdate(data);
              setIsVisible(true);
            }
          }
        }
      } catch (error) {
        console.warn("⚠️ [UpdateNotifier] Silent failure checking for updates (normal when offline):", error);
      } finally {
        setIsLoading(false);
      }
    }

    // Check on mount (app launch)
    checkForUpdates();
  }, []);

  const handleDownload = () => {
    if (update && update.downloadUrl) {
      window.open(update.downloadUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDismiss = () => {
    if (update) {
      // Remember this dismissal so we don't bug the user again until the next version is released
      localStorage.setItem("faso_educ_dismissed_update_version", update.version);
    }
    setIsVisible(false);
  };

  if (!isVisible || !update) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[9999] p-4 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-left relative text-white animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Gradient Banner decoration */}
        <div className="h-2 bg-gradient-to-r from-faso-green via-faso-blue to-yellow-500 w-full" />

        {/* Close Button (only shown if not a forced critical update) */}
        {!update.forceUpdate && (
          <button 
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-800 rounded-full text-gray-400 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X size={16} />
          </button>
        )}

        <div className="p-6">
          {/* Header Icon & Title */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-500/15 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <RefreshCw size={28} className="animate-spin-slow text-faso-blue" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                <Sparkles size={10} /> Mise à jour disponible
              </span>
              <h3 className="text-xl font-bold mt-2 text-white">
                Faso-Educ v{update.version}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Une nouvelle version de votre compagnon d'excellence est disponible.
              </p>
            </div>
          </div>

          {/* Current vs New info */}
          <div className="grid grid-cols-2 gap-3 mt-6 p-3 bg-slate-950/50 border border-slate-800/60 rounded-xl text-center text-xs">
            <div>
              <p className="text-gray-500">Version installée</p>
              <p className="font-mono font-medium text-gray-300 mt-0.5">v{LOCAL_APP_VERSION}</p>
            </div>
            <div className="border-l border-slate-800">
              <p className="text-gray-500">Nouvelle version</p>
              <p className="font-mono font-bold text-faso-green mt-0.5">v{update.version}</p>
            </div>
          </div>

          {/* Changelog section */}
          <div className="mt-5 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Quoi de neuf ?
            </h4>
            <div className="p-4 bg-slate-950/40 border border-slate-800/40 rounded-xl max-h-32 overflow-y-auto text-sm text-gray-300 leading-relaxed">
              {update.changelog || "Mises à jour de performance, corrections de bugs et nouvelles fonctionnalités pour optimiser vos révisions."}
            </div>
          </div>

          {/* Critical message for forced updates */}
          {update.forceUpdate && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p>Cette mise à jour est obligatoire pour continuer d'utiliser les services de Faso-Educ en toute sécurité.</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={handleDownload}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-faso-green to-faso-blue hover:opacity-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/10 active:scale-98 transition-all cursor-pointer"
            >
              <Download size={18} />
              Télécharger l'APK maintenant
            </button>

            {!update.forceUpdate && (
              <button
                onClick={handleDismiss}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 text-gray-300 hover:text-white font-medium rounded-xl text-xs text-center transition-colors cursor-pointer"
              >
                Plus tard (conserver la v{LOCAL_APP_VERSION})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
