import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type RenderingSystemProps = {
  platform?: string;
  system?: string;
};

function RenderingSystem({platform, system}: RenderingSystemProps) {
  return (
    <Container>
      <Tooltip title={t('Rendering System: %s', system ?? t('Unknown'))}>
        <PlatformIcon
          data-test-id="rendering-system-icon"
          platform={platform ?? 'generic'}
          size={21}
          radius={null}
        />
      </Tooltip>
    </Container>
  );
}

export {RenderingSystem};

const Container = styled('div')`
  position: absolute;
  top: -0.5px;
  left: -${space(3)};
  z-index: 1;

  img {
    border-radius: 4px 0 0 4px;
  }
`;
