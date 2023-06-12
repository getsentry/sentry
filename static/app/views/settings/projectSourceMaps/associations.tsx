import {Link} from 'react-router';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Hovercard} from 'sentry/components/hovercard';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DebugIdBundleAssociation} from 'sentry/types/sourceMaps';
import useOrganization from 'sentry/utils/useOrganization';

function AssociationsBody({associations}: {associations: DebugIdBundleAssociation[]}) {
  const organization = useOrganization();

  return (
    <ClippedBoxWithoutPadding
      clipHeight={210}
      btnText={t('+ %s more', associations.length - associations.slice(0, 4).length)}
      buttonProps={{
        priority: 'default',
        borderless: true,
      }}
    >
      <NumericList>
        {associations.map(({release, dist}) => (
          <li key={release}>
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
            {!dist?.length ? (
              <NoAssociations>
                {t('No dists associated with this release')}
              </NoAssociations>
            ) : (
              tct('Dist: [dist]', {
                dist: typeof dist === 'string' ? dist : dist.join(', '),
              })
            )}
          </li>
        ))}
      </NumericList>
    </ClippedBoxWithoutPadding>
  );
}

type Props = {
  associations?: DebugIdBundleAssociation[];
  loading?: boolean;
};

export function Associations({associations = [], loading}: Props) {
  if (loading) {
    return <Placeholder width="200px" height="20px" />;
  }

  if (!associations.length) {
    return (
      <NoAssociations>{t('No releases associated with this bundle')}</NoAssociations>
    );
  }

  return (
    <div>
      <WiderHovercard
        position="right"
        body={<AssociationsBody associations={associations} />}
        header={t('Releases')}
        displayTimeout={0}
        showUnderline
      >
        {tn('%s Release', '%s Releases', associations.length)}
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

// TODO(ui): Add a native numeric list to the List component
const NumericList = styled('ol')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  margin: 0;
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
