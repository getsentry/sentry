import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/feedback-empty-state.svg';

import Button, {ButtonLabel} from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {PlatformType} from 'app/types';

import {getConfigureAttachmentsDocsLink} from './utils';

type Props = {
  platform?: PlatformType;
};

function EmptyState({platform}: Props) {
  const configureAttachmentsDocsLink = getConfigureAttachmentsDocsLink(platform);

  return (
    <Wrapper>
      <img src={emptyStateImg} />
      <StyledButtonbar gap={1}>
        <Button priority="link" size="xsmall" to={configureAttachmentsDocsLink} external>
          {t('Setup screenshot')}
        </Button>
        {'|'}
        <Button priority="link" size="xsmall">
          {t('Dismiss')}
        </Button>
      </StyledButtonbar>
    </Wrapper>
  );
}

export default EmptyState;

const Wrapper = styled('div')`
  width: 100%;
  overflow: hidden;
  padding: ${space(2)} ${space(2)} ${space(1)} ${space(2)};
  display: flex;
  flex-direction: column;
  &,
  img {
    flex: 1;
  }
  img {
    height: 100%;
    width: auto;
    overflow: hidden;
    max-height: 100%;
  }
`;

const StyledButtonbar = styled(ButtonBar)`
  color: ${p => p.theme.gray200};
  justify-content: flex-start;
  margin-top: ${space(2)};
  ${ButtonLabel} {
    font-size: ${p => p.theme.fontSizeMedium};
    white-space: nowrap;
  }
`;
