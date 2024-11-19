import styled from '@emotion/styled';

import {RollbackBanner} from 'sentry/components/sidebar/rollback/banner';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';

type Props = {};

export function DismissableRollbackBanner({}: Props) {
  const config = useLegacyStore(ConfigStore);

  const isDarkMode = config.theme === 'dark';

  return (
    <Wrapper>
      <TranslucentBackgroundBanner dismissable isDarkMode={isDarkMode} />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: 0 ${space(1)};
`;

const TranslucentBackgroundBanner = styled(RollbackBanner)<{isDarkMode: boolean}>`
  position: relative;
  background: rgba(245, 243, 247, ${p => (p.isDarkMode ? 0.05 : 0.1)});
  border: 1px solid rgba(245, 243, 247, ${p => (p.isDarkMode ? 0.1 : 0.15)});
  color: ${p => (p.isDarkMode ? p.theme.textColor : '#ebe6ef')};
  margin: ${space(0.5)} ${space(1)};
`;
