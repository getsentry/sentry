import {createContext, useCallback, useContext, useRef} from 'react';

import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';

type DetectorFormContextType = {
  detectorType: DetectorType;
  /**
   * Tracks whether the user has manually set the detector name.
   * Used by useSetAutomaticName to disable automatic name generation.
   */
  getHasSetDetectorName: () => boolean;
  setHasSetDetectorName: (value: boolean) => void;
  detector?: Detector;
  duplicateDetector?: Detector;
};

const DetectorFormContext = createContext<DetectorFormContextType | null>(null);

export function DetectorFormProvider({
  detectorType,
  detector,
  duplicateDetector,
  initialHasSetDetectorName = false,
  children,
}: {
  children: React.ReactNode;
  detectorType: DetectorType;
  detector?: Detector;
  duplicateDetector?: Detector;
  initialHasSetDetectorName?: boolean;
}) {
  const hasSetDetectorNameRef = useRef(
    Boolean(duplicateDetector) || initialHasSetDetectorName
  );
  const getHasSetDetectorName = useCallback(() => hasSetDetectorNameRef.current, []);

  return (
    <DetectorFormContext.Provider
      value={{
        detectorType,
        getHasSetDetectorName,
        setHasSetDetectorName: value => {
          hasSetDetectorNameRef.current = value;
        },
        detector,
        duplicateDetector,
      }}
    >
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
