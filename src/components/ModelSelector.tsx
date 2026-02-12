
import React from 'react';
import { VideoModel } from '../types';

interface ModelSelectorProps {
  models: VideoModel[];
  selectedModelId: string;
  onSelect: (id: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ models, selectedModelId, onSelect }) => {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-400 mb-3">Select Generation Model</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {models.map((model) => {
          const isSelected = model.id === selectedModelId;
          return (
            <div
              key={model.id}
              onClick={() => onSelect(model.id)}
              className={`
                relative cursor-pointer rounded-xl p-4 border transition-all duration-200
                ${isSelected 
                  ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10' 
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                }
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                  {model.name}
                </span>
                {model.badge && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                    {model.badge}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                 <span className={`text-xs px-1.5 py-0.5 rounded border ${
                    model.provider === 'Google' ? 'border-blue-500/30 text-blue-400' :
                    model.provider === 'OpenAI' ? 'border-green-500/30 text-green-400' :
                    'border-purple-500/30 text-purple-400'
                 }`}>
                    {model.provider}
                 </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {model.description}
              </p>

              {isSelected && (
                <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
