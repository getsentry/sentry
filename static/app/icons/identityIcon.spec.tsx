import {createRef} from 'react';

import {render} from 'sentry-test/reactTestingLibrary';

import {IdentityIcon} from 'sentry/icons/identityIcon';

describe('IdentityIcon', () => {
  it('forwards its ref to the icon container', () => {
    const ref = createRef<HTMLDivElement>();

    const {container} = render(<IdentityIcon ref={ref} providerId="saml2" />);

    expect(ref.current).toBe(container.firstElementChild);
    expect(ref.current?.children).toHaveLength(1);
  });

  it('accepts background and display variants independently', () => {
    render(
      <IdentityIcon providerId="saml2" size={12} display="inline-flex" noBackground />
    );
  });
});
