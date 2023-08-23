import {Fragment} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Link from 'sentry/components/links/link';
import {IconFilter, IconSiren, IconSliders} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import AccordionRow from 'sentry/views/alerts/blueprints/accordionRow';
import {AlertTemplate} from 'sentry/views/alerts/blueprints/types';
import {TextCondition} from 'sentry/views/alerts/rules/issue/details/textRule';

function AlertTemplateSummary({template}: {template: AlertTemplate}) {
  const {projects} = useProjects();
  const organization = useOrganization();
  // TODO(Leander): Do this operation once rather than every render of this component
  const projectsByIds = projects.reduce((m, p) => {
    m[p.id] = p;
    return m;
  }, {});

  const {issue_alert_data: data, issue_alerts: alerts = []} = template;

  const {conditions = [], filters = [], actionMatch, filterMatch} = data;
  const titleComponent = (
    <TitleContainer>
      <IconSiren color="gray300" />
      <div>{tn('%s alert', '%s alerts', alerts.length)}</div>
      <TitleSpace>{'•'}</TitleSpace>
      <IconSliders color="gray300" />
      <div>{tn('%s condition', '%s conditions', conditions.length)}</div>
      <TitleSpace>{'•'}</TitleSpace>
      <IconFilter color="gray300" />
      <div>{tn('%s filter', '%s filters', filters.length)}</div>
    </TitleContainer>
  );
  return (
    <AccordionRow
      title={titleComponent}
      body={
        <DataContainer>
          <AlertContainer>
            {alerts.length === 0 && (
              <AlertEmptyMessage>
                {t('No alerts use this template yet!')}
                <br />
                <Link to={`/organizations/${organization.slug}/alerts/wizard/`}>
                  {t('Create one?')}
                </Link>
              </AlertEmptyMessage>
            )}
            {alerts.map((a, i) => {
              const project = projectsByIds[a.project];
              const link = `/organizations/${organization.slug}/alerts/rules/${project.slug}/${a.id}/details/`;
              return (
                <Fragment key={i}>
                  <AlertItem>
                    <AlertItemAvatar size={25} project={project} />
                    <AlertItemLink to={link}>{a.name}</AlertItemLink>
                    <AlertItemSubtitle>{project.name}</AlertItemSubtitle>
                  </AlertItem>
                  {i !== alerts.length - 1 && <AlertDivider />}
                </Fragment>
              );
            })}
          </AlertContainer>
          <QualifierContainer>
            <QualifierGroup>
              {conditions.length > 0 && (
                <QualifierHeader>
                  {tct('[when:When] an event is captured[selector]...', {
                    when: <PurpleText />,
                    selector: (
                      <Fragment>
                        {conditions.length ? (
                          <Fragment>
                            {tct(' and [match]', {
                              match: <PurpleText>{actionMatch}</PurpleText>,
                            })}
                          </Fragment>
                        ) : (
                          ''
                        )}
                      </Fragment>
                    ),
                  })}
                </QualifierHeader>
              )}
              {conditions.map((c, i) => (
                <QualifierText key={i}>
                  <IconSliders color="gray300" />
                  <TextCondition condition={c} />
                </QualifierText>
              ))}
            </QualifierGroup>
            <QualifierGroup>
              {filters.length > 0 && (
                <QualifierHeader>
                  {tct('[if:If] [selector] of these filters match...', {
                    if: <PurpleText />,
                    selector: <PurpleText>{filterMatch}</PurpleText>,
                  })}
                </QualifierHeader>
              )}
              {filters.map((f, i) => (
                <QualifierText key={i}>
                  <IconFilter color="gray300" />
                  {f.time ? f.name + '(s)' : f.name}
                </QualifierText>
              ))}
            </QualifierGroup>
          </QualifierContainer>
        </DataContainer>
      }
    />
  );
}

const TitleSpace = styled('div')`
  margin: 0 ${space(1)};
`;

const TitleContainer = styled('div')`
  display: flex;
  align-items: center;
  * {
    margin: 0 0.2rem;
  }
`;
const DataContainer = styled('div')`
  padding: ${space(0.5)};
  display: grid;
  grid-template: 1fr / 1fr 1fr;
  gap: ${space(1.5)};
`;

const AlertContainer = styled('div')`
  grid-template-columns: 1 2;
`;

const AlertEmptyMessage = styled('div')`
  margin-top: ${space(1)};
  text-align: center;
`;

const AlertDivider = styled('hr')`
  border: 1px solid ${p => p.theme.border};
  margin: ${space(1)};
`;

const AlertItem = styled('div')`
  display: grid;
  grid-template: 1fr 1fr / 25px 1fr;
  column-gap: ${space(0.75)};
  padding: ${space(1)} ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  align-items: center;
`;

const AlertItemAvatar = styled(ProjectAvatar)`
  grid-area: 1 / 1 / 3 / 2;
`;

const AlertItemLink = styled(Link)`
  grid-area: 1 / 2 / 2 / 3;
  font-weight: bold;
  ${p => p.theme.overflowEllipsis}
`;

const AlertItemSubtitle = styled('div')`
  grid-area: 2 / 2 / 3 / 3;
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const QualifierContainer = styled('div')`
  grid-template-columns: 2 3;
`;

const PurpleText = styled('span')`
  color: ${p => p.theme.purple400};
  text-transform: uppercase;
  font-weight: bold;
`;

const QualifierGroup = styled('div')`
  margin-bottom: ${space(2)};
`;

const QualifierHeader = styled('div')`
  font-size: 0.8rem;
  margin-bottom: ${space(0.75)};
  color: ${p => p.theme.subText};
`;

const QualifierText = styled('div')`
  display: grid;
  grid-template-columns: 20px 1fr;
  align-items: center;
  gap: ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)};
  margin: ${space(0.75)} 0;
  background: ${p => p.theme.surface200};
`;

export default AlertTemplateSummary;
