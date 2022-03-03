import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types';

type Props = {
  organization?: Organization;
};

function Test(props: Props) {
  return <div>{props.organization?.slug}</div>;
}

it('should do whatever', () => {
  mountWithTheme(<Test />);
});
