import styled from '@emotion/styled';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';

import {CreateProject} from './createProject';

function NewProject() {
  return (
    <SentryDocumentTitle>
        <Container>
          <div className="container">
            <Content>
              <CreateProject />
            </Content>
          </div>
        </Container>
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
