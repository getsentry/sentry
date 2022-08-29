import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {IconChevron, IconDelete} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {fetchGroupEvent} from 'sentry/views/organizationGroupDetails/utils';

import IssueSetCarouselItem from './IssueSetCarouselItem';

type Props = {
  issues: Group[];
  organization: Organization;
  projects: Project[];
  issueSet?: any;
};

function IssueSetCarousel({issues, organization, projects, ...props}: Props) {
  const emptyIssueDataMap = {};
  for (const issue of issues) {
    emptyIssueDataMap[issue.id] = {};
  }

  const [selectedIssueIndex, selectIssueIndex] = useState(0);
  const [issueDataMap, updateIssueDataMap] = useState(emptyIssueDataMap);
  const api = useApi();

  useEffect(() => {
    const eventPromises = issues.map(issue =>
      fetchGroupEvent(
        api,
        organization.slug,
        issue.id,
        'latest',
        [],
        issue.project as any
      )
    );
    Promise.all(eventPromises).then(events =>
      events.forEach(event => {
        updateIssueDataMap(dm => ({
          ...dm,
          [`${event.groupID}`]: {...dm[`${event.groupID}`], event},
        }));
      })
    );
  }, [api, issues, organization]);

  const renderMap = issues.reduce((map, issue, index) => {
    const project = projects.find(p => p.id === (issue.project as any));
    map[index] = (
      <IssueSetCarouselItem
        key={issue.id}
        issue={issue}
        project={project ?? ({} as Project)}
        organization={organization}
        event={issueDataMap[issue.id].event}
        {...props}
      />
    );
    return map;
  }, {});

  return (
    <CarouselContainer>
      {renderMap[selectedIssueIndex]}
      <CarouselButtonContainer>
        <CarouselButton
          aria-label="Previous Issue"
          size="sm"
          onClick={() =>
            selectIssueIndex(
              selectedIssueIndex - 1 < 0 ? issues.length - 1 : selectedIssueIndex - 1
            )
          }
          icon={<IconChevron direction="left" />}
        />
        <CarouselButton
          aria-label="Remove Issue from Set"
          size="sm"
          onClick={() => {}}
          icon={<IconDelete />}
        />
        <CarouselButton
          aria-label="Next Issue"
          size="sm"
          onClick={() =>
            selectIssueIndex(
              selectedIssueIndex + 1 >= issues.length ? 0 : selectedIssueIndex + 1
            )
          }
          icon={<IconChevron direction="right" />}
        />
      </CarouselButtonContainer>
    </CarouselContainer>
  );
}

const CarouselButtonContainer = styled('div')`
  background: ${p => p.theme.purple200};
  border-radius: 1000px;
  padding: ${space(1)};
  position: fixed;
  display: inline-block;
  top: ${space(3)};
  right: ${space(4)};
  z-index: 10;
`;

const CarouselButton = styled(Button)`
  border: 0;
  margin-right: ${space(0.5)};
  &:first-child {
    border-radius: 1000px ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 1000px;
  }
  &:last-child {
    margin-right: 0;
    border-radius: ${p => p.theme.borderRadius} 1000px 1000px ${p => p.theme.borderRadius};
  }
`;

const CarouselContainer = styled('div')``;

export default IssueSetCarousel;
