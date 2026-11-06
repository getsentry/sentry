jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() =>
    Promise.resolve({
      createToken: jest.fn(() => Promise.resolve({token: {id: 'test-token'}})),
      confirmCardPayment: jest.fn(() =>
        Promise.resolve({
          error: undefined,
          paymentIntent: {id: 'test-payment'},
        })
      ),
      confirmCardSetup: jest.fn((secretKey: string) => {
        if (secretKey === 'ERROR') {
          return Promise.resolve({error: {message: 'card invalid'}});
        }
        return Promise.resolve({
          error: undefined,
          setupIntent: {payment_method: 'test-pm'},
        });
      }),
      handleCardAction: jest.fn(() =>
        Promise.resolve({setupIntent: {payment_method: 'test-pm'}})
      ),
      elements: jest.fn(() => ({
        create: jest.fn(() => ({
          mount: jest.fn(),
          on: jest.fn(),
          update: jest.fn(),
        })),
      })),
    })
  ),
}));
jest.mock('@stripe/react-stripe-js', () => {
  const {useEffect} = jest.requireActual('react');
  return {
    Elements: jest.fn(({children}: {children: any}) => children),
    AddressElement: jest.fn(({onReady}: any) => {
      // Simulate AddressElement loading by calling onReady after mount
      useEffect(() => {
        if (onReady) {
          // Use setTimeout to allow initial render assertions to run
          setTimeout(() => onReady(), 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }),
    CardElement: jest.fn(() => null),
    PaymentElement: jest.fn(({onChange, onReady}: any) => {
      // Simulate a completed Stripe form by calling onChange and onReady after mount
      useEffect(() => {
        // Use setTimeout to allow initial render assertions to run
        setTimeout(() => {
          if (onReady) {
            onReady();
          }
          if (onChange) {
            onChange({complete: true});
          }
        }, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }),
    useStripe: jest.fn(() => ({
      confirmCardPayment: jest.fn(() =>
        Promise.resolve({
          error: undefined,
          paymentIntent: {id: 'test-payment'},
        })
      ),
      // Used to run a 3D Secure challenge on an intent created with
      // confirmation_method=manual, which the server then confirms.
      handleCardAction: jest.fn((clientSecret: string) => {
        if (clientSecret === 'ERROR') {
          return Promise.resolve({error: {message: 'authentication failed'}});
        }
        // Stripe rejects outright on some failures rather than resolving with
        // an error, and callers have to survive both.
        if (clientSecret === 'REJECT') {
          return Promise.reject(new Error('authentication failed'));
        }
        return Promise.resolve({
          error: undefined,
          paymentIntent: {id: 'test-payment'},
        });
      }),
      confirmCardSetup: jest.fn((secretKey: string) => {
        if (secretKey === 'ERROR') {
          return Promise.resolve({error: {message: 'card invalid'}});
        }
        return Promise.resolve({
          error: undefined,
          setupIntent: {payment_method: 'test-pm'},
        });
      }),
      confirmSetup: jest.fn((options: any) => {
        if (options?.clientSecret === 'ERROR') {
          return Promise.resolve({error: {message: 'card invalid'}});
        }
        return Promise.resolve({
          error: undefined,
          setupIntent: {payment_method: 'test-pm'},
        });
      }),
      confirmPayment: jest.fn((options: any) => {
        if (options?.clientSecret === 'ERROR') {
          return Promise.resolve({error: {message: 'payment failed'}});
        }
        return Promise.resolve({
          error: undefined,
          paymentIntent: {id: 'test-payment'},
        });
      }),
    })),
    useElements: jest.fn(() => ({
      getElement: jest.fn(() => ({})),
      submit: jest.fn(() => Promise.resolve({error: undefined})),
    })),
  };
});
jest.mock('getsentry/utils/trackMarketingEvent');
jest.mock('getsentry/utils/trackAmplitudeEvent');
jest.mock('getsentry/utils/trackReloadEvent');
jest.mock('getsentry/utils/trackMetric');
