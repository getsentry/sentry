import React from 'react';

import {DEPLOY_PREVIEW_CONFIG} from 'app/constants';
import {t, tct} from 'app/locale';
import AlertActions from 'app/actions/alertActions';
import ExternalLink from 'app/components/links/externalLink';

export function displayDeployPreviewAlert() {
  if (!DEPLOY_PREVIEW_CONFIG) {
    return;
  }

  const {commitRef, reviewId, repoUrl} = DEPLOY_PREVIEW_CONFIG;
  const repoName = repoUrl.match(/\w+\/\w+\/?$/)[0];

  const pullLink = (
    <ExternalLink href={`${repoUrl}/pull/${reviewId}`}>
      {t('%s#%s', repoName, reviewId)}
    </ExternalLink>
  );

  const sha = (
    <ExternalLink href={`${repoUrl}/commit/${commitRef}`}>
      @{commitRef.slice(0, 6)}
    </ExternalLink>
  );

  AlertActions.addAlert({
    message: tct('You are viewing a frontend deploy preview of [pullLink] ([sha])', {
      pullLink,
      sha,
    }),
    type: 'info',
    neverExpire: true,
  });
}
