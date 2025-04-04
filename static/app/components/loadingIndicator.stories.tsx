import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('LoadingIndicator', story => {
  story('Default', () => <LoadingIndicator />);

  story('Mini', () => <LoadingIndicator mini />);
  story('Sizes', () => (
    <div>
      <LoadingIndicator size={24} />
      <StyledLoadingIndicator size={24} />
    </div>
  ));

  story('With Message', () => <LoadingIndicator>Loading...</LoadingIndicator>);
});

const StyledLoadingIndicator = styled(LoadingIndicator)`
  width: 24px;
  height: 24px;
`;
