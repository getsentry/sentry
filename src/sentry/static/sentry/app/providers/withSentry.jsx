/* global process */
import React from 'react';

import withOrganization from './withOrganization';
import withTeam from './withTeam';
import withProject from './withProject';
import withApi from './withApi';

// compose(a, b, c)(x) = c(b(a(x)));
const compose = (...funcs) => {
  return (x) => funcs.reduce((acc, nextFn) => nextFn(acc), x);
};

const hocMap = new Map([
  ['organization', withOrganization],
  ['team', compose(withOrganization, withTeam)],
  ['project', compose(withOrganization, withTeam, withProject)],
  ['api', withApi],
]);

export default function withSentry(...hocNames) {
  // Accepts: 1) 1 arg as an array or 2) string args
  let hocNamesArray = Array.isArray(hocNames[0]) ? hocNames[0] : hocNames;

  // Change into an array of functions
  let hocs = hocNamesArray.map((hocName) => {
    if (process.env.NODE_ENV === 'development' &&
      !hocMap.has(hocName)
    ) {
      // eslint-disable-next-line no-console
      console.warn(`Invalid sentry provider: ${hocName} (must be one of: ${hocMap.keys().join(', ')})`);
    }

    return hocMap.get(hocName);
  });

  // Return a series of HoC's
  return (WrappedComponent) => {
    class WithSentry extends React.Component {
      render() {
        return <WrappedComponent
          {...this.props}
        />;
      }
    }

    return compose(...hocs)(WithSentry);
  };
}
