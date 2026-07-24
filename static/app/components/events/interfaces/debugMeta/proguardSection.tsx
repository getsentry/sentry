import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {KeyValueList} from 'sentry/components/events/interfaces/keyValueList';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EntryDebugMeta} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

interface ProguardSectionProps {
  data: EntryDebugMeta['data'];
  projectSlug: Project['slug'];
}

export function ProguardSection({data, projectSlug}: ProguardSectionProps) {
  const organization = useOrganization();

  const proguardImage = data.images?.find(image => image?.type === 'proguard');
  const uuid = proguardImage?.uuid;

  if (!uuid) {
    return null;
  }

  return (
    <FoldSection
      title={t('ProGuard Mapping')}
      sectionKey={SectionKey.PROGUARD}
      initialCollapse
    >
      <KeyValueList
        data={[
          {
            key: 'uuid',
            subject: t('UUID'),
            value: (
              <Flex align="center" gap="md">
                <UuidValue className="val-string">{uuid}</UuidValue>
                <LinkButton
                  size="xs"
                  icon={<IconOpen />}
                  tooltipProps={{
                    title: t(
                      'Search for this mapping file in the %s project settings',
                      projectSlug
                    ),
                  }}
                  aria-label={t('Open in Settings')}
                  to={{
                    pathname: `/settings/${organization.slug}/projects/${projectSlug}/debug-symbols/`,
                    query: {query: uuid},
                  }}
                />
              </Flex>
            ),
          },
        ]}
      />
    </FoldSection>
  );
}

const UuidValue = styled('pre')`
  flex-grow: 1;
`;
