import {Button} from '@sentry/scraps/button';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

export default Storybook.story('UpsellModal', story => {
  story('Default', () => {
    const organization = useOrganization();

    return (
      <Button onClick={() => openUpsellModal({organization, source: 'stories'})}>
        Open upsell modal
      </Button>
    );
  });
});
