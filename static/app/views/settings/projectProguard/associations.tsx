import {Link} from 'react-router';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Hovercard} from 'sentry/components/hovercard';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {ProguardMappingAssociation} from 'sentry/views/settings/projectProguard';

function ProguardAssociationsBody({
  associations,
}: {
  associations: ProguardMappingAssociation;
}) {
  const organization = useOrganization();

  return (
    <ClippedBoxWithoutPadding
      clipHeight={210}
      btnText={t(
        '+ %s more',
        associations.releases.length - associations.releases.slice(0, 4).length
      )}
      buttonProps={{
        priority: 'default',
        borderless: true,
      }}
    >
      <List symbol="bullet">
        {associations.releases.map(release => (
          <ListItem key={release}>
            <ReleaseContent>
              <ReleaseLink
                to={`/organizations/${organization.slug}/releases/${release}/`}
              >
                <TextOverflow>{release}</TextOverflow>
              </ReleaseLink>
              <CopyToClipboardButton
                text={release}
                borderless
                size="zero"
                iconSize="sm"
              />
            </ReleaseContent>
          </ListItem>
        ))}
      </List>
    </ClippedBoxWithoutPadding>
  );
}

type Props = {
  associations: ProguardMappingAssociation;
  loading?: boolean;
};

export function ProguardAssociations({associations, loading}: Props) {
  if (loading) {
    return <Placeholder width="200px" height="20px" />;
  }

  if (!associations.releases.length) {
    return (
      <NoAssociations>
        {t('No releases associated with this proguard mapping file')}
      </NoAssociations>
    );
  }

  return (
    <div>
      <WiderHovercard
        position="right"
        body={<ProguardAssociationsBody associations={associations} />}
        header={t('Releases')}
        displayTimeout={0}
        showUnderline
      >
        {tn('%s Release', '%s Releases', associations.releases.length)}
      </WiderHovercard>{' '}
      {t('associated')}
    </div>
  );
}

const NoAssociations = styled('div')`
  color: ${p => p.theme.disabled};
`;

const ReleaseContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
  align-items: center;
`;

const ReleaseLink = styled(Link)`
  overflow: hidden;
`;

const WiderHovercard = styled(Hovercard)`
  width: 320px;
  /* "Body" element */
  > div:last-child {
    transition: all 5s ease-in-out;
    overflow-x: hidden;
    overflow-y: scroll;
    max-height: 300px;
  }
`;

const ClippedBoxWithoutPadding = styled(ClippedBox)`
  padding: 0;
  /* "ClipFade" element */
  > div:last-child {
    background: ${p => p.theme.background};
    border-bottom: 0;
    padding: 0;
  }
`;
