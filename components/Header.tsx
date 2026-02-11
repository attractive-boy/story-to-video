import React from 'react';
import { AppStep } from '../types';

interface HeaderProps {
  currentStep: AppStep;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentStep, onReset }) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 mb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onReset}>
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
              <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.94-.94 2.56-.27 2.56 1.06v11.38c0 1.33-1.62 2-2.56 1.06z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Story2Video
          </h1>
        </div>
        
        <div className="flex items-center gap-4 text-sm font-medium text-slate-400">
          <span className={currentStep === AppStep.INPUT || currentStep === AppStep.GENERATING_IMAGES ? "text-indigo-400" : ""}>1. Imagine</span>
          <span className="text-slate-700">/</span>
          <span className={currentStep === AppStep.SELECTION ? "text-indigo-400" : ""}>2. Select</span>
          <span className="text-slate-700">/</span>
          <span className={currentStep === AppStep.GENERATING_VIDEOS ? "text-indigo-400" : ""}>3. Animate</span>
        </div>
      </div>
    </header>
  );
};