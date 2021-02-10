import React from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'app/components/charts/styles';
import DateTime from 'app/components/dateTime';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OrganizationSummary} from 'app/types';
import {Event, EventTransaction} from 'app/types/event';
import {getShortEventId} from 'app/utils/events';
import {getDuration} from 'app/utils/formatters';
import getDynamicText from 'app/utils/getDynamicText';
import Projects from 'app/utils/projects';

type Props = {
  event: Event;
  organization: OrganizationSummary;
  projectId: string;
};

function EventMetas({event, organization, projectId}: Props) {
  if (!isTransaction(event)) {
    return null;
  }

  const projectBadge = (
    <Projects orgId={organization.slug} slugs={[projectId]}>
      {({projects}) => {
        const project = projects.find(p => p.slug === projectId);
        return (
          <ProjectBadge project={project ? project : {slug: projectId}} avatarSize={16} />
        );
      }}
    </Projects>
  );

  const timestamp = (
    <DateTime
      date={getDynamicText({
        value: event.dateCreated || (event.endTimestamp || 0) * 1000,
        fixed: 'Dummy timestamp',
      })}
    />
  );

  const httpStatus = <HttpStatus event={event} />;

  return (
    <MetaDatasContainer>
      <MetaData
        headingText={t('Event ID')}
        tooltipText={t('The unique ID assigned to this transaction.')}
        bodyText={getShortEventId(event.eventID)}
        subtext={projectBadge}
      />
      <MetaData
        headingText={t('Total Duration')}
        tooltipText={t(
          'The total time elapsed between the start and end of this transaction.'
        )}
        bodyText={getDuration(event.endTimestamp - event.startTimestamp, 2, true)}
        subtext={timestamp}
      />
      <MetaData
        headingText={t('Status')}
        tooltipText={t(
          'The status of this transaction indicating if it succeeded or otherwise.'
        )}
        bodyText={event.contexts?.trace?.status ?? '\u2014'}
        subtext={httpStatus}
      />
    </MetaDatasContainer>
  );
}

function HttpStatus({event}: {event: Event}) {
  const {tags} = event;

  const emptyStatus = <React.Fragment>{'\u2014'}</React.Fragment>;

  if (!Array.isArray(tags)) {
    return emptyStatus;
  }

  const tag = tags.find(tagObject => tagObject.key === 'http.status_code');

  if (!tag) {
    return emptyStatus;
  }

  return <React.Fragment>HTTP {tag.value}</React.Fragment>;
}

function isTransaction(event: Event): event is EventTransaction {
  return event.type === 'transaction';
}

const MetaDatasContainer = styled('div')`
  display: grid;
  grid-column-gap: ${space(2)};
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
`;

type MetaDataProps = {
  headingText: string;
  tooltipText: string;
  bodyText: string;
  subtext: React.ReactNode;
};

function MetaData({headingText, tooltipText, bodyText, subtext}: MetaDataProps) {
  return (
    <div>
      <StyledSectionHeading>
        {headingText}
        <QuestionTooltip
          position="top"
          size="sm"
          containerDisplayMode="block"
          title={tooltipText}
        />
      </StyledSectionHeading>
      <SectionBody>{bodyText}</SectionBody>
      <SectionSubtext>{subtext}</SectionSubtext>
    </div>
  );
}

const StyledSectionHeading = styled(SectionHeading)`
  color: ${p => p.theme.textColor};
`;

const SectionBody = styled('p')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.headerFontSize};
  margin-bottom: ${space(1)};
`;

const SectionSubtext = styled('div')`
  margin-bottom: ${space(3)};
  color: ${p => p.theme.subText};
`;

export default EventMetas;
