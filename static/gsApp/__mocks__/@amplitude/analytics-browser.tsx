const identifyInstance: any = {
  set: jest.fn(() => identifyInstance),
};

export const Identify = jest.fn(() => identifyInstance);
export const setUserId = jest.fn();
export const identify = jest.fn();
export const init = jest.fn();
export const track = jest.fn();
export const setGroup = jest.fn();

export const _identifyInstance = identifyInstance;
