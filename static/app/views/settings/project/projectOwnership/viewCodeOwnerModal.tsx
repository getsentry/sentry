import {Fragment} from 'react';
import {css, type Theme} from '@emotion/react';

import {Flex, Stack} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {SectionHeading} from 'sentry/components/charts/styles';
import {t} from 'sentry/locale';
import type {CodeOwner} from 'sentry/types/integrations';
import {getCodeOwnerIcon} from 'sentry/utils/integrationUtil';
import RulesPanel from 'sentry/views/settings/project/projectOwnership/rulesPanel';

interface ViewCodeOwnerModalProps extends ModalRenderProps {
  codeowner: CodeOwner;
}

function ViewCodeOwnerModal({Body, Header, codeowner}: ViewCodeOwnerModalProps) {
  return (
    <Fragment>
      <Header closeButton>
        <Flex align="center" gap="md">
          {getCodeOwnerIcon(codeowner.provider)}
          <h4>{codeowner.codeMapping?.repoName}</h4>
        </Flex>
      </Header>
      <Body>
        <Stack gap="xl">
          <div>
            <div>
              <SectionHeading>{t('Code Mapping:')}</SectionHeading>
            </div>
            {t('Stack Trace Root -')} <code>{codeowner.codeMapping?.stackRoot}</code>
            <br />
            {t('Source Code Root -')} <code>{codeowner.codeMapping?.sourceRoot}</code>
          </div>

          <RulesPanel
            data-test-id="issueowners-panel"
            type="codeowners"
            provider={codeowner.provider}
            raw={codeowner.ownershipSyntax || ''}
            dateUpdated={codeowner.dateUpdated}
          />
        </Stack>
      </Body>
    </Fragment>
  );
}

export const modalCss = (theme: Theme) => css`
  @media (min-width: ${theme.breakpoints.sm}) {
    width: 80%;
  }
  [role='document'] {
    overflow: initial;
  }
`;

export default ViewCodeOwnerModal;
