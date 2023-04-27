import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {SectionHeading} from 'sentry/components/charts/styles';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CodeOwner} from 'sentry/types';
import {getCodeOwnerIcon} from 'sentry/utils/integrationUtil';
import theme from 'sentry/utils/theme';
import RulesPanel from 'sentry/views/settings/project/projectOwnership/rulesPanel';

interface ViewCodeOwnerModalProps extends ModalRenderProps {
  codeowner: CodeOwner;
}

function ViewCodeOwnerModal({Body, Header, codeowner}: ViewCodeOwnerModalProps) {
  return (
    <Fragment>
      <Header closeButton>
        <HeaderContainer>
          {getCodeOwnerIcon(codeowner.provider)}
          <h4>{codeowner.codeMapping?.repoName}</h4>
        </HeaderContainer>
      </Header>
      <Body>
        <BodyContainer>
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
        </BodyContainer>
      </Body>
    </Fragment>
  );
}

const HeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const BodyContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

export const modalCss = css`
  @media (min-width: ${theme.breakpoints.small}) {
    width: 80%;
  }
  [role='document'] {
    overflow: initial;
  }
`;

export default ViewCodeOwnerModal;
