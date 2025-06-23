type Flow = {
  description: string;
  id: string;
  name: string;
};

export const getFlow = (flowId: string): Flow => {
  const flowData = require('./data/example1.jsonc');

  return {
    id: flowData.id,
    name: 'This is a flow for login',
    description: 'flow1',
  };
};

const flowIds = ['acd5d72f6ba54385ac80abe9dfadb142', '312bbd1e066e489eb3001615302ace13'];
