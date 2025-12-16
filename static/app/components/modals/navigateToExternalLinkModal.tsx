import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';

type Props = ModalRenderProps & {
  linkText: string;
};

function NavigateToExternalLinkModal({Body, closeModal, Header, linkText}: Props) {
  const handleClose = () => closeModal();

  return (
    <Fragment>
      <Header closeButton>
        <h2>{t('Heads up')}</h2>
      </Header>
      <Body>
        <p data-test-id="external-link-warning">
          {t(
            "You're leaving Sentry and will be redirected to the following external website:"
          )}
        </p>
        <ParagraphContainer>{linkText}</ParagraphContainer>
        &nbsp;
      </Body>
      <Stack direction="column" gap="10px">
        <Flex justify="end" gap="5px">
          <LinkButton priority="primary" href={linkText} onClick={handleClose} external>
            {t('Continue')}
          </LinkButton>
          <Button priority="default" onClick={handleClose}>
            {t('Cancel')}
          </Button>
        </Flex>
      </Stack>
    </Fragment>
  );
}

export default NavigateToExternalLinkModal;

const ParagraphContainer = styled('p')`
  word-break: break-all;
  white-space: normal;
`;
