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
import {getPlatform, trimPackage} from './utils';
import FrameDefaultTitleOriginalSourceInfo from './frameDefaultTitleOriginalSourceInfo';
import {Frame, PlatformType} from './types';

type Props = {
  frame: Frame;
  platform: PlatformType;
};

type GetPathNameOutput = {key: string; value: string; meta?: Meta};

const FrameDefaultTitle = ({frame, platform}: Props) => {
  const title: Array<React.ReactElement> = [];
  const framePlatform = getPlatform(frame.platform, platform);

  const handleExternalLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  };

  const getPathName = (shouldPrioritizeModuleName: boolean): GetPathNameOutput => {
    if (shouldPrioritizeModuleName) {
      if (frame.module) {
        return {
          key: 'module',
          value: frame.module,
          meta: getMeta(frame, 'module'),
        };
      }
      return {
        key: 'filename',
        value: frame.filename,
        meta: getMeta(frame, 'filename'),
      };
    }

    if (frame.filename) {
      return {
        key: 'filename',
        value: frame.filename,
        meta: getMeta(frame, 'filename'),
      };
    }

    return {
      key: 'module',
      value: frame.module,
      meta: getMeta(frame, 'module'),
    };
  };

  // TODO(dcramer): this needs to use a formatted string so it can be
  // localized correctly
  if (defined(frame.filename || frame.module)) {
    // prioritize module name for Java as filename is often only basename
    const shouldPrioritizeModuleName =
      framePlatform === 'java' || framePlatform === 'csharp';

    const pathName = getPathName(shouldPrioritizeModuleName);
    const enablePathTooltip = defined(frame.absPath) && frame.absPath !== pathName.value;

    title.push(
      <Tooltip key={pathName.key} title={frame.absPath} disabled={!enablePathTooltip}>
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
    if (shouldPrioritizeModuleName && frame.filename && framePlatform !== 'csharp') {
      title.push(
        <Tooltip key={frame.filename} title={frame.filename}>
          <a className="in-at real-filename">
            <IconQuestion size="xs" />
          </a>
        </Tooltip>
      );
    }

    if (frame.absPath && isUrl(frame.absPath)) {
      title.push(
        <ExternalLink
          href={frame.absPath}
          className="icon-open"
          key="share"
          onClick={handleExternalLink}
        />
      );
    }

    if (defined(frame.function) || defined(frame.rawFunction)) {
      title.push(
        <span className="in-at" key="in">
          {` ${t('in')} `}
        </span>
      );
    }
  }

  if (defined(frame.function) || defined(frame.rawFunction)) {
    title.push(<FrameFunctionName frame={frame} key="function" className="function" />);
  }

  // we don't want to render out zero line numbers which are used to
  // indicate lack of source information for native setups.  We could
  // TODO(mitsuhiko): only do this for events from native platforms?
  if (defined(frame.lineNo) && frame.lineNo !== 0) {
    title.push(
      <span className="in-at in-at-line" key="no">
        {` ${t('at line')} `}
      </span>
    );
    title.push(
      <code key="line" className="lineno">
        {defined(frame.colNo) ? `${frame.lineNo}:${frame.colNo}` : frame.lineNo}
      </code>
    );
  }

  if (defined(frame.package) && framePlatform !== 'csharp') {
    title.push(
      <span className="within" key="within">
        {` ${t('within')} `}
      </span>
    );
    title.push(
      <code title={frame.package} className="package" key="package">
        {trimPackage(frame.package)}
      </code>
    );
  }

  if (defined(frame.origAbsPath)) {
    title.push(
      <Tooltip
        key="info-tooltip"
        title={
          <FrameDefaultTitleOriginalSourceInfo mapUrl={frame.mapUrl} map={frame.map} />
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
