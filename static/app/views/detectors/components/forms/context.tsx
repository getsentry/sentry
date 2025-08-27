import {createContext, useContext} from 'react';

import type {Project} from 'sentry/types/project';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';

type DetectorFormContextType = {
  detectorType: DetectorType;
  project: Project;
};

const DetectorFormContext = createContext<DetectorFormContextType | null>(null);

export function DetectorFormProvider({
  detectorType,
  project,
  children,
}: {
  children: React.ReactNode;
  detectorType: DetectorType;
  project: Project;
}) {
  return (
    <DetectorFormContext.Provider value={{detectorType, project}}>
      {children}
    </DetectorFormContext.Provider>
  );
}

export function useDetectorFormContext() {
  const context = useContext(DetectorFormContext);
  if (!context) {
    throw new Error('useDetectorFormContext must be used within a DetectorFormProvider');
  }

  return context;
}
