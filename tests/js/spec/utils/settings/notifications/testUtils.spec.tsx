import {
  decideDefault,
  getUserDefaultValues,
} from 'sentry/views/settings/account/notifications/utils';

describe('Notification Settings Utils', () => {
  describe('getUserDefaultValues', () => {
    describe('when notificationsSettings are empty', () => {
      it('should return fallback values', () => {
        expect(getUserDefaultValues('deploy', {})).toEqual({
          email: 'committed_only',
          slack: 'never',
        });
      });
    });
    describe('when notificationsSettings are not empty', () => {
      it('should return the parent-independent notificationSettings', () => {
        expect(
          getUserDefaultValues('alerts', {
            alerts: {
              user: {
                me: {
                  email: 'never',
                  slack: 'never',
                },
              },
            },
          })
        ).toEqual({
          email: 'never',
          slack: 'never',
        });
      });
    });
  });

  describe('decideDefault', () => {
    describe('when there are no parent-specific settings', () => {
      describe('when the parent-independent settings match', () => {
        it('should return always when the settings are always', () => {
          expect(
            decideDefault('alerts', {
              alerts: {
                user: {
                  me: {
                    email: 'always',
                    slack: 'always',
                  },
                },
              },
            })
          ).toEqual('always');
        });

        it('should return never when the settings are never', () => {
          expect(
            decideDefault('alerts', {
              alerts: {
                user: {
                  me: {
                    email: 'never',
                    slack: 'never',
                  },
                },
              },
            })
          ).toEqual('never');
        });
      });
      describe('when the parent-independent settings do not match', () => {
        it('should return the always when the other value is never', () => {
          expect(
            decideDefault('alerts', {
              alerts: {
                user: {
                  me: {
                    email: 'always',
                    slack: 'never',
                  },
                },
              },
            })
          ).toEqual('always');
        });
      });
    });

    describe('when there are parent-specific settings', () => {
      describe('when the parent-specific settings are "below" the parent-independent settings', () => {
        it('should "prioritize" always over never', () => {
          expect(
            decideDefault('alerts', {
              alerts: {
                user: {
                  me: {
                    email: 'never',
                    slack: 'never',
                  },
                },
                project: {
                  1: {
                    email: 'always',
                    slack: 'always',
                  },
                },
              },
            })
          ).toEqual('always');
        });
        it('should "prioritize" sometimes over always', () => {
          expect(
            decideDefault('alerts', {
              alerts: {
                user: {
                  me: {
                    email: 'never',
                    slack: 'never',
                  },
                },
                project: {
                  1: {
                    email: 'subscribe_only',
                    slack: 'subscribe_only',
                  },
                },
              },
            })
          ).toEqual('subscribe_only');
        });
      });
      describe('when the parent-specific settings are "above" the parent-independent settings', () => {
        it('should return the parent-specific settings', () => {
          expect(
            decideDefault('alerts', {
              alerts: {
                user: {
                  me: {
                    email: 'always',
                    slack: 'always',
                  },
                },
                project: {
                  1: {
                    email: 'never',
                    slack: 'never',
                  },
                },
              },
            })
          ).toEqual('always');
        });
      });
    });
  });
});
