import {useCallback, useEffect, useState} from 'react';

import type {Flow} from 'sentry/views/codecov/flows/types';

const STORAGE_KEY = 'sentry-codecov-flows';

export function useLocalStorageFlows() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load flows from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      console.log('Loading flows from localStorage:', {stored, key: STORAGE_KEY});
      if (stored) {
        const parsedFlows = JSON.parse(stored);
        console.log('Parsed flows:', parsedFlows);
        setFlows(Array.isArray(parsedFlows) ? parsedFlows : []);
      }
    } catch (error) {
      console.error('Error loading flows from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save flows to localStorage whenever flows change
  useEffect(() => {
    if (!isLoading) {
      try {
        console.log('Saving flows to localStorage:', flows);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
      } catch (error) {
        console.error('Error saving flows to localStorage:', error);
      }
    }
  }, [flows, isLoading]);

  const createFlow = useCallback(
    (flowData: Omit<Flow, 'id' | 'lastSeen' | 'lastChecked'>): Promise<Flow> => {
      return new Promise(resolve => {
        const newFlow: Flow = {
          ...flowData,
          id: `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          lastSeen: new Date().toISOString(),
          lastChecked: new Date().toISOString(),
        };

        console.log('Creating new flow:', newFlow);

        setFlows(prev => {
          const updatedFlows = [...prev, newFlow];
          console.log('Updated flows array:', updatedFlows);
          // Resolve the promise after the state update
          setTimeout(() => resolve(newFlow), 0);
          return updatedFlows;
        });
      });
    },
    []
  );

  const updateFlow = useCallback((flowId: string, updates: Partial<Flow>) => {
    setFlows(prev =>
      prev.map(flow =>
        flow.id === flowId
          ? {...flow, ...updates, lastChecked: new Date().toISOString()}
          : flow
      )
    );
  }, []);

  const deleteFlow = useCallback((flowId: string) => {
    setFlows(prev => prev.filter(flow => flow.id !== flowId));
  }, []);

  const getFlow = useCallback(
    (flowId: string) => {
      return flows.find(flow => flow.id === flowId);
    },
    [flows]
  );

  const clearAllFlows = useCallback(() => {
    setFlows([]);
  }, []);

  const resetToSampleData = useCallback(() => {
    setFlows(sampleFlows);
  }, []);

  return {
    flows,
    isLoading,
    createFlow,
    updateFlow,
    deleteFlow,
    getFlow,
    clearAllFlows,
    resetToSampleData,
  };
}
