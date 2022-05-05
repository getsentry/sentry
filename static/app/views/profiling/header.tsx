import styled from '@emotion/styled';

import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type ProfilingPage = 'landing' | 'functions';

interface ProfilingHeaderProps {
  page: ProfilingPage;
  project: Project;
  transaction: string;
  version: string;
}

function ProfilingHeader(props: ProfilingHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumb
          location={location}
          organization={organization}
          trails={[
            {type: 'landing'},
            {
              type: 'functions',
              payload: {
                projectSlug: props.project.slug,
                transaction: props.transaction,
                version: props.version,
              },
            },
          ]}
        />
        <Layout.Title>
          <Title>
            {props.project && (
              <IdBadge
                project={props.project}
                avatarSize={28}
                hideName
                avatarProps={{hasTooltip: true, tooltip: props.project.slug}}
              />
            )}
            {tct('[transaction] \u2014 [version]', {
              transaction: props.transaction,
              version: props.version,
            })}
          </Title>
        </Layout.Title>
      </Layout.HeaderContent>
    </Layout.Header>
  );
}

const Title = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

export {ProfilingHeader};
