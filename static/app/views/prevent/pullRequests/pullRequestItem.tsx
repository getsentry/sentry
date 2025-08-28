import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import useOrganization from 'sentry/utils/useOrganization';

import type {PullRequest} from './types';

interface PullRequestItemProps {
  pullRequest: PullRequest;
}

function PullRequestItem({pullRequest}: PullRequestItemProps) {
  const organization = useOrganization();
  const {title, number, state, html_url, updated_at, user, repository, head, base} =
    pullRequest;

  const internalPrUrl = `/organizations/${organization.slug}/prevent/pull-requests/${encodeURIComponent(repository.full_name)}/pr/${number}/`;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      if (diffInHours === 0) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        return t('%s minutes ago', formatAbbreviatedNumber(diffInMinutes));
      }
      return t('%s hours ago', formatAbbreviatedNumber(diffInHours));
    }
    if (diffInDays === 1) {
      return t('1 day ago');
    }
    return t('%s days ago', formatAbbreviatedNumber(diffInDays));
  };

  const getStateText = () => {
    if (state === 'closed') {
      return t('Merged');
    }
    return t('Open');
  };

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the GitHub button
    if ((e.target as HTMLElement).closest('a[href*="github.com"]')) {
      return;
    }
    window.location.href = internalPrUrl;
  };

  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e7e8ea',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        backgroundColor: '#fff',
        transition: 'background-color 0.15s ease',
        cursor: 'pointer',
      }}
      onClick={handleRowClick}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = '#f8f9fa';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = '#fff';
      }}
    >
      <div style={{flex: 1, minWidth: 0}}>
        <div
          style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px'}}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: '14px',
              color: '#1f2328',
            }}
          >
            <a
              href={html_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#0969da',
                textDecoration: 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {title}
            </a>
          </div>
          <span
            style={{
              color: '#656d76',
              fontSize: '13px',
              fontWeight: 'normal',
            }}
          >
            #{number}
          </span>
        </div>

        <div
          style={{
            fontSize: '12px',
            color: '#656d76',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{fontWeight: 500, color: '#1f2328'}}>{repository.name}</span>
          <span>•</span>
          <span
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              fontSize: '11px',
              backgroundColor: '#f6f8fa',
              padding: '2px 6px',
              borderRadius: '6px',
              border: '1px solid #d1d9e0',
            }}
          >
            {base.ref} ← {head.ref}
          </span>
          <span>•</span>
          <span
            style={{
              fontWeight: 500,
              color: state === 'closed' ? '#8250df' : '#1a7f37',
            }}
          >
            {getStateText()}
          </span>
          <span>•</span>
          <span>{formatTimeAgo(updated_at)}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          marginLeft: '16px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            color: '#656d76',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>by {user.login}</span>
        </div>

        <a
          href={html_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '12px',
            color: '#0969da',
            textDecoration: 'none',
            padding: '4px 8px',
            border: '1px solid #d1d9e0',
            borderRadius: '6px',
            backgroundColor: '#f6f8fa',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            const target = e.currentTarget;
            target.style.backgroundColor = '#f3f4f6';
            target.style.borderColor = '#c7c7c7';
          }}
          onMouseLeave={e => {
            const target = e.currentTarget;
            target.style.backgroundColor = '#f6f8fa';
            target.style.borderColor = '#d1d9e0';
          }}
        >
          View on GitHub
        </a>
      </div>
    </div>
  );
}

export default PullRequestItem;
