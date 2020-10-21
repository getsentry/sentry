import {DEPLOY_PREVIEW_CONFIG, EXPERIMENTAL_SPA} from 'app/constants';
import {t, tct} from 'app/locale';
import AlertActions from 'app/actions/alertActions';
import ExternalLink from 'app/components/links/externalLink';

export function displayDeployPreviewAlert() {
  if (!DEPLOY_PREVIEW_CONFIG) {
    return;
  }

  const {branch, commitSha, githubOrg, githubRepo} = DEPLOY_PREVIEW_CONFIG;
  const repoUrl = `https://github.com/${githubOrg}/${githubRepo}`;

  const commitLink = (
    <ExternalLink href={`${repoUrl}/commit/${commitSha}`}>
      {t('%s@%s', `${githubOrg}/${githubRepo}`, commitSha.slice(0, 6))}
    </ExternalLink>
  );

  const branchLink = (
    <ExternalLink href={`${repoUrl}/tree/${branch}`}>{branch}</ExternalLink>
  );

  AlertActions.addAlert({
    id: 'deploy-preview',
    message: tct(
      'You are viewing a frontend deploy preview of [commitLink] ([branchLink])',
      {commitLink, branchLink}
    ),
    type: 'warning',
    neverExpire: true,
    noDuplicates: true,
  });
}

export function displayExperimentalSpaAlert() {
  if (!EXPERIMENTAL_SPA) {
    return;
  }

  AlertActions.addAlert({
    id: 'develop-proxy',
    message: t(
      'You are developing against production Sentry API, please BE CAREFUL, as your changes will affect production data.'
    ),
    type: 'warning',
    neverExpire: true,
    noDuplicates: true,
  });
}
