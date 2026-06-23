const actual = jest.requireActual('sentry/utils/recreateRoute');

export const matchesToRoutes = actual.matchesToRoutes;

export const recreateRoute = jest.fn((name: any) => name);
