import {ExternalLink} from '@sentry/scraps/link';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import type {ApiApplication} from 'sentry/types/user';

import {DetailLabel} from 'admin/components/detailLabel';

type Authorization = {
  application: ApiApplication;
  dateCreated: string;
  id: string;
  organization: {name: string; slug: string} | null;
  scopes: string[];
};

type Props = {
  authorizations: Authorization[];
};

export function UserAuthorizedApps({authorizations}: Props) {
  if (!authorizations.length) {
    return (
      <Panel>
        <PanelHeader>Authorized Applications</PanelHeader>
        <PanelBody>
          <EmptyMessage>No authorized applications.</EmptyMessage>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader>Authorized Applications</PanelHeader>
      <PanelBody>
        {authorizations.map(auth => (
          <PanelItem key={auth.id} style={{flexDirection: 'column', gap: 4}}>
            <strong>{auth.application.name}</strong>
            {auth.application.homepageUrl && (
              <small>
                <ExternalLink href={auth.application.homepageUrl}>
                  {auth.application.homepageUrl}
                </ExternalLink>
              </small>
            )}
            <DetailLabel title="Scopes">
              <small>{auth.scopes.join(', ') || '(none)'}</small>
            </DetailLabel>
            {auth.organization && (
              <DetailLabel title="Organization">
                <small>{auth.organization.slug}</small>
              </DetailLabel>
            )}
          </PanelItem>
        ))}
      </PanelBody>
    </Panel>
  );
}
