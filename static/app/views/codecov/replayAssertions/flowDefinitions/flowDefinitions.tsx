type FlowDefinition = {
  id: string;
  description: string;
  name: string;
  ending_actions: Array<Assertion<any>>;
  id: string;
  name: string;
  // UUID
  prev_id: string | null;
  starting_action: StartingAction;
  // Track changes over time
  // assigned_to: User | Team | null;
  status: 'Success' | 'Fail';
  timeout: Assertion<TimeRange>;
};

interface StartingAction {
  // Define starting action properties
}

interface Assertion<T> {
  // Define assertion properties
}

interface TimeRange {
  // Define time range properties
}


export const getFlowDefinition = (arg1: string): FlowDefinition => {
  return {
    id: 'flowDefintion1',
    name: 'This is a flow for login',
    description: 'flowDefintion1',
    steps: [
      {
        name: 'step1',
        description: 'step1',
      },
    ],
  };
};
