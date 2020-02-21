import React from 'react';

import {Meta} from 'app/types';
import {defined, isUrl} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import Truncate from 'app/components/truncate';
import {IconQuestion} from 'app/icons/iconQuestion';
import ExternalLink from 'app/components/links/externalLink';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import {t} from 'app/locale';
import {getMeta} from 'app/components/events/meta/metaProxy';

import FrameFunctionName from './frameFunctionName';
import getPlatform from './getPlatform';
import trimPackage from './trimPackage';
import FrameDefaultTitleOriginalSourceInfo from './frameDefaultTitleOriginalSourceInfo';
import {Data, PlatformType} from './types';

type Props = {
  data: Data;
  platform: PlatformType;
};

type GetPathNameOutput = {key: string; value: string; meta?: Meta};

const FrameDefaultTitle = ({data, platform}: Props) => {
  const title: Array<React.ReactElement> = [];
  const framePlatform = getPlatform(data.platform, platform);

  const handleExternalLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  };

  const getPathName = (shouldPrioritizeModuleName: boolean): GetPathNameOutput => {
    if (shouldPrioritizeModuleName) {
      if (data.module) {
        return {
          key: 'module',
          value: data.module,
          meta: getMeta(data, 'module'),
        };
      }
      return {
        key: 'filename',
        value: data.filename,
        meta: getMeta(data, 'filename'),
      };
    }

    if (data.filename) {
      return {
        key: 'filename',
        value: data.filename,
        meta: getMeta(data, 'filename'),
      };
    }

    return {
      key: 'module',
      value: data.module,
      meta: getMeta(data, 'module'),
    };
  };

  // TODO(dcramer): this needs to use a formatted string so it can be
  // localized correctly
  if (defined(data.filename || data.module)) {
    // prioritize module name for Java as filename is often only basename
    const shouldPrioritizeModuleName =
      framePlatform === 'java' || framePlatform === 'csharp';

    const pathName = getPathName(shouldPrioritizeModuleName);

    console.log('pathName', pathName);

    const enablePathTooltip = defined(data.absPath) && data.absPath !== pathName.value;

    title.push(
      <Tooltip key={pathName.key} title={data.absPath} disabled={!enablePathTooltip}>
        <code key="filename" className="filename">
          {pathName.meta ? (
            <AnnotatedText
              value={<Truncate value={pathName.value} maxLength={100} leftTrim />}
              chunks={pathName.meta.chunks}
              remarks={pathName.meta.rem}
              errors={pathName.meta.err}
            />
          ) : (
            <Truncate value={pathName.value} maxLength={100} leftTrim />
          )}
        </code>
      </Tooltip>
    );

    // in case we prioritized the module name but we also have a filename info
    // we want to show a litle (?) icon that on hover shows the actual filename
    if (shouldPrioritizeModuleName && data.filename && framePlatform !== 'csharp') {
      title.push(
        <Tooltip key={data.filename} title={data.filename}>
          <a className="in-at real-filename">
            <IconQuestion size="xs" />
          </a>
        </Tooltip>
      );
    }

    if (data.absPath && isUrl(data.absPath)) {
      title.push(
        <ExternalLink
          href={data.absPath}
          className="icon-open"
          key="share"
          onClick={handleExternalLink}
        />
      );
    }

    if (defined(data.function) || defined(data.rawFunction)) {
      title.push(
        <span className="in-at" key="in">
          {` ${t('in')} `}
        </span>
      );
    }
  }

  if (defined(data.function) || defined(data.rawFunction)) {
    title.push(<FrameFunctionName data={data} key="function" className="function" />);
  }

  // we don't want to render out zero line numbers which are used to
  // indicate lack of source information for native setups.  We could
  // TODO(mitsuhiko): only do this for events from native platforms?
  if (defined(data.lineNo) && data.lineNo !== 0) {
    title.push(
      <span className="in-at in-at-line" key="no">
        {` ${t('at line')} `}
      </span>
    );
    title.push(
      <code key="line" className="lineno">
        {defined(data.colNo) ? `${data.lineNo}:${data.colNo}` : data.lineNo}
      </code>
    );
  }

  if (defined(data.package) && framePlatform !== 'csharp') {
    title.push(
      <span className="within" key="within">
        {` ${t('within')} `}
      </span>
    );
    title.push(
      <code title={data.package} className="package" key="package">
        {trimPackage(data.package)}
      </code>
    );
  }

  if (defined(data.origAbsPath)) {
    title.push(
      <Tooltip
        key="info-tooltip"
        title={
          <FrameDefaultTitleOriginalSourceInfo mapUrl={data.mapUrl} map={data.map} />
        }
      >
        <a className="in-at original-src">
          <IconQuestion size="xs" />
        </a>
      </Tooltip>
    );
  }

  return title;
};

export default FrameDefaultTitle;
