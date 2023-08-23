import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import parseLinkHeader, {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type State = {
  /**
   * If any request returned an error then nothing is being returned
   */
  fetchError: undefined | RequestError;

  /**
   * If a fetch is underway for the requested root reply.
   * This includes fetched all the sub-resources like attachments and `sentry-replay-event`
   */
  fetchingAttachments: boolean;
  fetchingErrors: boolean;
  fetchingReplay: boolean;
};

type Options = {
  /**
   * The organization slug
   */
  orgSlug: string;

  /**
   * The replayId
   */
  replayId: string;

  /**
   * Default: 50
   * You can override this for testing
   */
  errorsPerPage?: number;

  /**
   * Default: 100
   * You can override this for testing
   */
  segmentsPerPage?: number;
};

interface Result {
  accessibilityFrames: unknown[];
  attachments: unknown[];
  errors: ReplayError[];
  fetchError: undefined | RequestError;
  fetching: boolean;
  onRetry: () => void;
  projectSlug: string | null;
  replayRecord: ReplayRecord | undefined;
}

const INITIAL_STATE: State = Object.freeze({
  fetchError: undefined,
  fetchingAttachments: true,
  fetchingErrors: true,
  fetchingReplay: true,
  fetchingAccessibilityFrames: true,
});

/**
 * A react hook to load core replay data over the network.
 *
 * Core replay data includes:
 * 1. The root replay EventTransaction object
 *    - This includes `startTimestamp`, and `tags`
 * 2. RRWeb, Breadcrumb, and Span attachment data
 *    - We make an API call to get a list of segments, each segment contains a
 *      list of attachments
 *    - There may be a few large segments, or many small segments. It depends!
 *      ie: If the replay has many events/errors then there will be many small segments,
 *      or if the page changes rapidly across each pageload, then there will be
 *      larger segments, but potentially fewer of them.
 * 3. Related Event data
 *    - Event details are not part of the attachments payload, so we have to
 *      request them separately
 *
 * This function should stay focused on loading data over the network.
 * Front-end processing, filtering and re-mixing of the different data streams
 * must be delegated to the `ReplayReader` class.
 *
 * @param {orgSlug, replayId} Where to find the root replay event
 * @returns An object representing a unified result of the network requests. Either a single `ReplayReader` data object or fetch errors.
 */
function useReplayData({
  replayId,
  orgSlug,
  errorsPerPage = 50,
  segmentsPerPage = 100,
}: Options): Result {
  const projects = useProjects();

  const api = useApi();

  const [state, setState] = useState<State>(INITIAL_STATE);
  const [attachments, setAttachments] = useState<unknown[]>([]);
  const attachmentMap = useRef<Map<string, unknown[]>>(new Map()); // Map keys are always iterated by insertion order
  const [errors, setErrors] = useState<ReplayError[]>([]);
  const [accessibilityFrames, setAccessibilityFrames] = useState<ReplayError[]>([]);
  const [replayRecord, setReplayRecord] = useState<ReplayRecord>();

  const projectSlug = useMemo(() => {
    if (!replayRecord) {
      return null;
    }
    return projects.projects.find(p => p.id === replayRecord.project_id)?.slug ?? null;
  }, [replayRecord, projects.projects]);

  // Fetch every field of the replay. We're overfetching, not every field is used
  const fetchReplay = useCallback(async () => {
    const response = await api.requestPromise(makeFetchReplayApiUrl(orgSlug, replayId));
    const mappedRecord = mapResponseToReplayRecord(response.data);
    setReplayRecord(mappedRecord);
    setState(prev => ({...prev, fetchingReplay: false}));
  }, [api, orgSlug, replayId]);

  const fetchAttachments = useCallback(async () => {
    if (!replayRecord || !projectSlug) {
      return;
    }

    if (!replayRecord.count_segments) {
      setState(prev => ({...prev, fetchingAttachments: false}));
      return;
    }

    const pages = Math.ceil(replayRecord.count_segments / segmentsPerPage);
    const cursors = new Array(pages).fill(0).map((_, i) => `0:${segmentsPerPage * i}:0`);
    cursors.forEach(cursor => attachmentMap.current.set(cursor, []));

    await Promise.allSettled(
      cursors.map(cursor => {
        const promise = api.requestPromise(
          `/projects/${orgSlug}/${projectSlug}/replays/${replayRecord.id}/recording-segments/`,
          {
            query: {
              download: true,
              per_page: segmentsPerPage,
              cursor,
            },
          }
        );
        promise.then(response => {
          attachmentMap.current.set(cursor, response);
          const flattened = Array.from(attachmentMap.current.values()).flat(2);
          setAttachments(flattened);
        });
        return promise;
      })
    );
    setState(prev => ({...prev, fetchingAttachments: false}));
  }, [segmentsPerPage, api, orgSlug, replayRecord, projectSlug]);

  const fetchErrors = useCallback(async () => {
    if (!replayRecord) {
      return;
    }

    // Clone the `finished_at` time and bump it up one second because finishedAt
    // has the `ms` portion truncated, while replays-events-meta operates on
    // timestamps with `ms` attached. So finishedAt could be at time `12:00:00.000Z`
    // while the event is saved with `12:00:00.450Z`.
    const finishedAtClone = new Date(replayRecord.finished_at);
    finishedAtClone.setSeconds(finishedAtClone.getSeconds() + 1);

    const paginatedErrors = fetchPaginatedReplayErrors(api, {
      orgSlug,
      replayId: replayRecord.id,
      start: replayRecord.started_at,
      end: finishedAtClone,
      limit: errorsPerPage,
    });

    for await (const pagedResults of paginatedErrors) {
      setErrors(prev => [...prev, ...(pagedResults || [])]);
    }

    setState(prev => ({...prev, fetchingErrors: false}));
  }, [api, orgSlug, replayRecord, errorsPerPage]);

  const fetchAccessibilityFrames = useCallback(async () => {
    if (!attachments || attachments.length === 0) {
      return;
    }

    // // await a post to localhost:3000 with the replayRecord.events
    // const atts = JSON.stringify(attachments);
    // const response = await fetch('http://localhost:3000/events', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: atts,
    // });
    // // get body from response
    // const body = await response.json();

    const body = [
      {
        id: 'button-name',
        impact: 'critical',
        description: 'Buttons must have discernible text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/button-name?application=playwright',
        element:
          '<button class="copy"><svg style="width: 16px; height: 16px;"></svg></button>',
        failureSummary:
          'Fix any of the following:\n  Element does not have inner text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element\'s default semantics were not overridden with role="none" or role="presentation"',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/data-collected/">**** *********</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/migration/">********* *****</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/performance/">*** ** ***********</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/profiling/">*** ** *********</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/crons/">*** ** *****</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/enriching-events/context/">*** *******</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/enriching-events/identify-user/">******** *****</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/enriching-events/transaction-name/">*** *********** ****</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/enriching-events/tags/">********* ****</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/enriching-events/user-feedback/">**** ********</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/enriching-events/scopes/">****** *** ****</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a href="https://fastapi.tiangolo.com/" class="">******* *********<span class="icon icon-external-link"><svg style="width: 14px; height: 14px;"></svg></span></a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.62 (foreground color: #e1557c, background color: #ffffff, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<span class="token comment">* *** ****************** ** *** ** ******* ****</span>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 2.99 (foreground color: #77658b, background color: #251f3d, font size: 11.3pt (15px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<span class="token comment">* ** ************ *** *********** ***********</span>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 2.99 (foreground color: #77658b, background color: #251f3d, font size: 11.3pt (15px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<span class="token comment">* ** ********* ********* **** ***** ** ***********</span>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 2.99 (foreground color: #77658b, background color: #251f3d, font size: 11.3pt (15px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element: '<span class="token comment">* ***</span>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 2.99 (foreground color: #77658b, background color: #251f3d, font size: 11.3pt (15px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a href="https://github.com/getsentry/sentry-docs/edit/master/src/platforms/python/guides/fastapi/index.mdx" class="">******* ** **** ** **** ****<span class="icon icon-external-link"><svg style="width: 14px; height: 14px;"></svg></span></a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.44 (foreground color: #e1557c, background color: #faf8ff, font size: 9.7pt (12.92px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a href="https://docs.sentry.io/contributing/" class="">********** ** ****<span class="icon icon-external-link"><svg style="width: 14px; height: 14px;"></svg></span></a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.44 (foreground color: #e1557c, background color: #faf8ff, font size: 9.7pt (12.92px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a href="https://github.com/getsentry/sentry-docs/issues/new/choose" class="">****** * *******<span class="icon icon-external-link"><svg style="width: 14px; height: 14px;"></svg></span></a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.44 (foreground color: #e1557c, background color: #faf8ff, font size: 9.7pt (12.92px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'duplicate-id-active',
        impact: 'serious',
        description: 'IDs of active elements must be unique',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/duplicate-id-active?application=playwright',
        element:
          '<a aria-haspopup="true" aria-expanded="false" id="nd-platforms" href="https://docs.sentry.io/platforms/python/guides/fastapi/#" class="dropdown-toggle nav-link" role="button"><img style="width: 0px; height: 0px;">*******</a>',
        failureSummary:
          'Fix any of the following:\n  Document has active elements with the same id attribute: nd-platforms',
      },
      {
        id: 'duplicate-id',
        impact: 'minor',
        description: 'id attribute value must be unique',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/duplicate-id?application=playwright',
        element: '<div class="d-sm-none d-block" id="navbar-menu">',
        failureSummary:
          'Fix any of the following:\n  Document has multiple static elements with the same id attribute: navbar-menu',
      },
      {
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/image-alt?application=playwright',
        element: '<img style="width: 50px; height: 30.6562px;">',
        failureSummary:
          'Fix any of the following:\n  Element does not have an alt attribute\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element\'s default semantics were not overridden with role="none" or role="presentation"',
      },
      {
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/image-alt?application=playwright',
        element: '<img style="width: 16px; height: 16px;">',
        failureSummary:
          'Fix any of the following:\n  Element does not have an alt attribute\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element\'s default semantics were not overridden with role="none" or role="presentation"',
      },
      {
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/image-alt?application=playwright',
        element:
          '<img class="gatsby-resp-image-image" style="width: 742.5px; height: 175.719px;">',
        failureSummary:
          'Fix any of the following:\n  Element does not have an alt attribute\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element\'s default semantics were not overridden with role="none" or role="presentation"',
      },
      {
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/image-alt?application=playwright',
        element:
          '<img class="gatsby-resp-image-image" style="width: 742.5px; height: 202.938px;">',
        failureSummary:
          'Fix any of the following:\n  Element does not have an alt attribute\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element\'s default semantics were not overridden with role="none" or role="presentation"',
      },
      {
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/link-name?application=playwright',
        element:
          '<a href="https://docs.sentry.io/static/502c68be8728b45907000721f9409472/ffaa5/issues-list.png" class="gatsby-resp-image-link" style="display:block" target="_blank" rel="noopener">',
        failureSummary:
          'Fix all of the following:\n  Element is in tab order and does not have accessible text\n\nFix any of the following:\n  Element does not have text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute',
      },
      {
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/link-name?application=playwright',
        element:
          '<a href="https://docs.sentry.io/static/7925169685c3d90602ab05f3ccf9d0ad/e515d/performance-details.png" class="gatsby-resp-image-link" style="display:block" target="_blank" rel="noopener">',
        failureSummary:
          'Fix all of the following:\n  Element is in tab order and does not have accessible text\n\nFix any of the following:\n  Element does not have text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element: '<h6>****</h6>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a aria-current="page" class=" sidebar-title d-flex align-items-center active" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/"><h6>****** *** *******</h6></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a aria-current="page" class="active css-1o62c7a active" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/">******* *******</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/configuration/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/usage/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/troubleshooting/">***************</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" sidebar-title d-flex align-items-center" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/performance/"><h6>*********** **********</h6></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/performance/instrumentation/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/performance/troubleshooting/">***************</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" sidebar-title d-flex align-items-center" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/profiling/"><h6>*********</h6></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/profiling/troubleshooting/">***************</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" sidebar-title d-flex align-items-center" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/crons/"><h6>*****</h6></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/crons/troubleshooting/">***************</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" sidebar-title d-flex align-items-center" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/enriching-events/"><h6>********* ******</h6></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/enriching-events/attachments/">***********</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/enriching-events/breadcrumbs/">***********</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" sidebar-title d-flex align-items-center" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/data-management/"><h6>**** **********</h6></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/data-management/sensitive-data/">********* ********* ****</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" sidebar-title d-flex align-items-center" data-sidebar-link="true" href="https://docs.sentry.io/product/"><h6>******* ******</h6></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/sentry-basics/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/issues/">******<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/projects/">********<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/performance/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/profiling/">*********<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/session-replay/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/crons/">*****<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/alerts/">******<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/discover-queries/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/dashboards/">**********<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/releases/">********<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/user-feedback/">**** ********</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/stats/">*****</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/codecov/">*******<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/security-policy-reporting/">******** ****** *********</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/data-management-settings/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/accounts/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/relay/">*****<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/cli/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/security/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/product/integrations/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" sidebar-title d-flex align-items-center" data-sidebar-link="true" href="https://docs.sentry.io/platforms/"><h6>***** *********</h6></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/dotnet/">****<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/android/">*******<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/apple/">*****<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/javascript/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/dart/">****<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/elixir/">******<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/flutter/">*******<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/go/">**<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/java/">****<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/kotlin/">******</a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/kotlin-multiplatform/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/native/">******<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/node/">*******<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/php/">***<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/react-native/">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/ruby/">****<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/rust/">****<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/unity/">*****<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<a class=" css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/unreal/">****** ******<style data-emotion="css 1eta2b">.css-1eta2b { transition: transform 200ms ease 0s; transform: rotate(270deg); }</style><svg class="css-1eta2b" style="width: 16px; height: 16px;"></svg></a>',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a href="https://sentry.io/auth/login/?next=https://docs.sentry.io/platforms/python/guides/fastapi/">****** **<span class="icon icon-external-link"><svg style="width: 14px; height: 14px;"></svg></span></a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.44 (foreground color: #e1557c, background color: #faf8ff, font size: 9.7pt (12.92px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a href="https://docs.sentry.io/platforms/python/guides/fastapi/#issue-reporting">***** *********</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a href="https://docs.sentry.io/platforms/python/guides/fastapi/#monitor-performance">******* ***********</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a href="https://docs.sentry.io/platforms/python/guides/fastapi/#integration-options">*********** *******</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a href="https://docs.sentry.io/platforms/python/guides/fastapi/#supported-versions">********* ********</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element: '<h4 style="display: inline-block;">****** *******</h4>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.3pt (13.76px), font weight: bold). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element: '<h4 style="display: inline-block;">*** ******</h4>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.3pt (13.76px), font weight: bold). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'heading-order',
        impact: 'moderate',
        description: 'Heading levels should only increase by one',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/heading-order?application=playwright',
        element: '<h6>** **** ****</h6>',
        failureSummary: 'Fix any of the following:\n  Heading order invalid',
      },
      {
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/image-alt?application=playwright',
        element: '<img style="width: 20px; height: 20px;">',
        failureSummary:
          'Fix any of the following:\n  Element does not have an alt attribute\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element\'s default semantics were not overridden with role="none" or role="presentation"',
      },
      {
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/link-name?application=playwright',
        element:
          '<a href="https://docs.sentry.io/static/502c68be8728b45907000721f9409472/ffaa5/issues-list.png" class="gatsby-resp-image-link" target="_blank" rel="noopener" style="display: block;">',
        failureSummary:
          'Fix all of the following:\n  Element is in tab order and does not have accessible text\n\nFix any of the following:\n  Element does not have text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute',
      },
      {
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/link-name?application=playwright',
        element:
          '<a href="https://docs.sentry.io/static/7925169685c3d90602ab05f3ccf9d0ad/e515d/performance-details.png" class="gatsby-resp-image-link" target="_blank" rel="noopener" style="display: block;">',
        failureSummary:
          'Fix all of the following:\n  Element is in tab order and does not have accessible text\n\nFix any of the following:\n  Element does not have text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<div class="d-md-flex flex-column align-items-stretch collapse navbar-collapse" id="sidebar">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/color-contrast?application=playwright',
        element:
          '<a class="css-1o62c7a" data-sidebar-link="true" href="https://docs.sentry.io/platforms/python/guides/fastapi/performance/">*** ** ***********</a>',
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 3.54 (foreground color: #9481a3, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
      {
        id: 'region',
        impact: 'moderate',
        description: 'All page content should be contained by landmarks',
        helpUrl:
          'https://dequeuniversity.com/rules/axe/4.7/region?application=playwright',
        element:
          '<div class="d-md-flex flex-column align-items-stretch collapse navbar-collapse :hover" id="sidebar">',
        failureSummary:
          'Fix any of the following:\n  Some page content is not contained by landmarks',
      },
    ];

    setAccessibilityFrames(body);

    setState(prev => ({...prev, fetchingAccessibilityFrames: false}));
  }, [attachments]);

  const onError = useCallback(error => {
    Sentry.captureException(error);
    setState(prev => ({...prev, fetchError: error}));
  }, []);

  const loadData = useCallback(
    () => fetchReplay().catch(onError),
    [fetchReplay, onError]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (state.fetchError) {
      return;
    }
    fetchErrors().catch(onError);
  }, [state.fetchError, fetchErrors, onError]);

  useEffect(() => {
    if (state.fetchError) {
      return;
    }
    fetchAttachments().catch(onError);
  }, [state.fetchError, fetchAttachments, onError]);

  useEffect(() => {
    if (state.fetchError) {
      return;
    }
    fetchAccessibilityFrames().catch(onError);
  }, [state.fetchError, fetchAccessibilityFrames, onError]);

  return {
    attachments,
    errors,
    accessibilityFrames,
    fetchError: state.fetchError,
    fetching: state.fetchingAttachments || state.fetchingErrors || state.fetchingReplay,
    onRetry: loadData,
    projectSlug,
    replayRecord,
  };
}

function makeFetchReplayApiUrl(orgSlug: string, replayId: string) {
  return `/organizations/${orgSlug}/replays/${replayId}/`;
}

async function fetchReplayErrors(
  api: Client,
  {
    orgSlug,
    start,
    end,
    replayId,
    limit = 50,
    cursor = '0:0:0',
  }: {
    end: Date;
    orgSlug: string;
    replayId: string;
    start: Date;
    cursor?: string;
    limit?: number;
  }
) {
  return await api.requestPromise(`/organizations/${orgSlug}/replays-events-meta/`, {
    includeAllArgs: true,
    query: {
      start: start.toISOString(),
      end: end.toISOString(),
      query: `replayId:[${replayId}]`,
      per_page: limit,
      cursor,
    },
  });
}

async function* fetchPaginatedReplayErrors(
  api: Client,
  {
    orgSlug,
    start,
    end,
    replayId,
    limit = 50,
  }: {
    end: Date;
    orgSlug: string;
    replayId: string;
    start: Date;
    limit?: number;
  }
): AsyncGenerator<ReplayError[]> {
  function next(nextCursor: string) {
    return fetchReplayErrors(api, {
      orgSlug,
      replayId,
      start,
      end,
      limit,
      cursor: nextCursor,
    });
  }
  let cursor: undefined | ParsedHeader = {
    cursor: '0:0:0',
    results: true,
    href: '',
  };
  while (cursor && cursor.results) {
    const [{data}, , resp] = await next(cursor.cursor);
    const pageLinks = resp?.getResponseHeader('Link') ?? null;
    cursor = parseLinkHeader(pageLinks)?.next;
    yield data;
  }
}

export default useReplayData;
