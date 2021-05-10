import {Fragment} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {openCreateOwnershipRule} from 'app/actionCreators/modal';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import Hovercard from 'app/components/hovercard';
import {IconQuestion} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';

import SidebarSection from '../sidebarSection';

type Props = {
  project: Project;
  organization: Organization;
  issueId: string;
};

const OwnershipRules = ({project, organization, issueId}: Props) => {
  const handleOpenCreateOwnershipRule = () => {
    openCreateOwnershipRule({project, organization, issueId});
  };

  return (
    <SidebarSection
      title={
        <Fragment>
          {t('Ownership Rules')}
          <ClassNames>
            {({css}) => (
              <Hovercard
                body={
                  <HelpfulBody>
                    <p>
                      {t(
                        'Ownership rules allow you to associate file paths and URLs to specific teams or users, so alerts can be routed to the right people.'
                      )}
                    </p>
                    <Button
                      href="https://docs.sentry.io/workflow/issue-owners/"
                      priority="primary"
                    >
                      {t('Learn more')}
                    </Button>
                  </HelpfulBody>
                }
                containerClassName={css`
                  display: flex;
                  align-items: center;
                `}
              >
                <StyledIconQuestion size="xs" />
              </Hovercard>
            )}
          </ClassNames>
        </Fragment>
      }
    >
      <GuideAnchor target="owners" position="bottom" offset={space(3)}>
        <Button onClick={handleOpenCreateOwnershipRule} size="small">
          {t('Create Ownership Rule')}
        </Button>
      </GuideAnchor>
    </SidebarSection>
  );
};

export {OwnershipRules};

const StyledIconQuestion = styled(IconQuestion)`
  margin-left: ${space(0.5)};
`;

const HelpfulBody = styled('div')`
  padding: ${space(1)};
  text-align: center;
`;
