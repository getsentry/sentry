import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {useOrganization} from 'sentry/utils/useOrganization';

import {CreateProject} from './createProject';
import {ScmCreateProject} from './scmCreateProject';

function NewProject() {
  const organization = useOrganization();
  const hasScmProjectCreation = organization.features.includes(
    'onboarding-scm-project-creation'
  );

  if (hasScmProjectCreation) {
    return <ScmCreateProject />;
  }

  return (
    <SentryDocumentTitle>
      <Stack flex={1}>
        <Container>
          <div className="container">
            <Content>
              <CreateProject />
            </Content>
          </div>
        </Container>
      </Stack>
    </SentryDocumentTitle>
  );
}

const Container = styled('div')`
  flex: 1;
  background: ${p => p.theme.tokens.background.primary};
`;

const Content = styled('div')`
  margin-top: ${p => p.theme.space['2xl']};
`;

export default NewProject;
