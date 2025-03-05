import {useState} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from 'sentry/components/core/checkbox';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import localStorage from 'sentry/utils/localStorage';

type Props = {
  docContent: string | undefined;
  docKey: string;
  prefix: string;
  project: Project;
};

export function OnboardingStep({docContent, docKey, prefix, project}: Props) {
  const [increment, setIncrement] = useState<number>(0);

  if (!docContent) {
    return null;
  }

  const localStorageKey = `${prefix}-onboarding-${project.id}-${docKey}`;

  function isChecked() {
    return localStorage.getItem(localStorageKey) === 'check';
  }

  return (
    <Wrapper>
      <TaskCheckBox>
        <Checkbox
          size="md"
          checked={isChecked()}
          onChange={event => {
            if (event.target.checked) {
              localStorage.setItem(localStorageKey, 'check');
            } else {
              localStorage.removeItem(localStorageKey);
            }
            setIncrement(increment + 1);

            return;
          }}
        />
      </TaskCheckBox>
      <DocumentationWrapper dangerouslySetInnerHTML={{__html: docContent}} />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
`;

const TaskCheckBox = styled('div')`
  float: left;
  margin-right: ${space(1.5)};
  height: 27px;
  display: flex;
  align-items: center;
  z-index: 2;
  position: relative;
`;

export const DocumentationWrapper = styled('div')`
  line-height: 1.5;

  .gatsby-highlight {
    margin-bottom: ${space(3)};

    &:last-child {
      margin-bottom: 0;
    }
  }

  .alert {
    margin-bottom: ${space(3)};
    border-radius: ${p => p.theme.borderRadius};
  }

  blockquote {
    padding: ${space(1)};
    margin-left: 0;
    background: ${p => p.theme.alert.info.backgroundLight};
    border-left: 2px solid ${p => p.theme.alert.info.border};
  }
  blockquote > *:last-child {
    margin-bottom: 0;
  }

  p > code {
    color: ${p => p.theme.pink300};
  }

  /* Ensures documentation content is placed behind the checkbox */
  z-index: 1;
  position: relative;
`;

export default OnboardingStep;
