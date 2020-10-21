import {withInfo} from '@storybook/addon-info';

import PageHeading from 'app/components/pageHeading';

export default {
  title: 'Layouts/PageHeading',
};

export const Default = withInfo(
  'Every page should have a header, and the header should be made with this.'
)(() => <PageHeading withMargins>Page Header</PageHeading>);

Default.story = {
  name: 'default',
};
