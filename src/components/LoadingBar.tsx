import React from 'react';

interface LoadingBarProps {
  progress: number;
  message?: string;
}

export const LoadingBar: React.FC<LoadingBarProps> = ({ progress, message }) => {
  return (
    <div className="w-full max-w-xl mx-auto p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-indigo-400">{message || 'Processing...'}</span>
        <span className="text-sm font-medium text-slate-400">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5">
        <div 
          className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};