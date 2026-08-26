import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_OP_CONDITION = `${SpanFields.TRANSACTION_OP}:[ui.load,navigation]`;
const ROOT_TRANSACTION_CONDITION = `${SpanFields.IS_TRANSACTION}:true ${TRANSACTION_OP_CONDITION}`;
export const TRANSACTION_COUNT = `count_unique(${SpanFields.TRANSACTION_SPAN_ID})`;

// Mobile vitals need to cover two span shapes. In the legacy transaction shape,
// vital values are measurements on the root ui.load/navigation transaction; EAP
// coalesces those old measurement keys into the app.vitals.* attributes below.
// In the newer span shape, the same vital can arrive as a standalone span with a
// specific span.op. Query both shapes so mixed SDK versions appear in one dashboard.
export const TTID_CONDITION = `(${ROOT_TRANSACTION_CONDITION} has:${SpanFields.APP_VITALS_TTID_VALUE} OR ${SpanFields.SPAN_OP}:ui.load.initial_display has:${SpanFields.APP_VITALS_TTID_VALUE})`;
export const TTFD_CONDITION = `(${ROOT_TRANSACTION_CONDITION} has:${SpanFields.APP_VITALS_TTFD_VALUE} OR ${SpanFields.SPAN_OP}:ui.load.full_display has:${SpanFields.APP_VITALS_TTFD_VALUE})`;

// Group by app.vitals.start.screen. start.value is not a registered duration
// yet, so has: uses tags[...,number] (search cannot parse millisecond) and
// avg uses millisecond so the columns format as durations. Relay backfills
// start.value / start.type / start.screen onto V1 ui.load roots, so this
// matches both V1 (after normalization) and native V2 app-start spans.
const START_VALUE_NUMBER = `tags[${SpanFields.APP_VITALS_START_VALUE},number]`;
const START_VALUE_DURATION = `tags[${SpanFields.APP_VITALS_START_VALUE},millisecond]`;
export const APP_START_TABLE_CONDITION = `(has:${SpanFields.APP_VITALS_START_SCREEN} AND has:${START_VALUE_NUMBER})`;
export const AVG_START_VALUE = `avg(${START_VALUE_DURATION})`;
export const AVG_COLD_START = `avg_if(${START_VALUE_DURATION},${SpanFields.APP_VITALS_START_TYPE},equals,cold)`;
export const AVG_WARM_START = `avg_if(${START_VALUE_DURATION},${SpanFields.APP_VITALS_START_TYPE},equals,warm)`;
export const COLD_START_CONDITION = `(${APP_START_TABLE_CONDITION} AND ${SpanFields.APP_VITALS_START_TYPE}:cold)`;
export const WARM_START_CONDITION = `(${APP_START_TABLE_CONDITION} AND ${SpanFields.APP_VITALS_START_TYPE}:warm)`;

// TTFD can be absent while TTID is present because reportFullyDrawn() is opt-in.
export const SCREEN_LOAD_CONDITION = `(${TTID_CONDITION} OR ${TTFD_CONDITION})`;
export const SCREEN_LOAD_TABLE_CONDITION = `${SCREEN_LOAD_CONDITION} has:${SpanFields.TRANSACTION}`;

// Top-level frame metrics use root screen-load transactions so each screen load
// contributes once. The detail dashboard can use span-level frame metrics since
// each span carries the frame data associated with that span.
export const SCREEN_RENDERING_CONDITION = `${ROOT_TRANSACTION_CONDITION} has:${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT}`;
export const SCREEN_RENDERING_TABLE_CONDITION = `${SCREEN_RENDERING_CONDITION} has:${SpanFields.TRANSACTION}`;
export const SCREEN_RENDERING_SPAN_OPERATIONS_CONDITION = `!${SpanFields.IS_TRANSACTION}:true has:${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT} has:${SpanFields.SPAN_OP}`;

const APP_START_OPERATIONS = `${SpanFields.SPAN_OP}:[app.start.cold,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]`;
const APP_START_DESCRIPTION_EXCLUSIONS = `!${SpanFields.SPAN_DESCRIPTION}:"Cold Start" !${SpanFields.SPAN_DESCRIPTION}:"Warm Start" !${SpanFields.SPAN_DESCRIPTION}:"Cold App Start" !${SpanFields.SPAN_DESCRIPTION}:"Warm App Start" !${SpanFields.SPAN_DESCRIPTION}:"Initial Frame Render"`;
const APP_START_NAME_EXCLUSIONS = `!${SpanFields.NAME}:"Cold Start" !${SpanFields.NAME}:"Warm Start" !${SpanFields.NAME}:"Cold App Start" !${SpanFields.NAME}:"Warm App Start" !${SpanFields.NAME}:"Initial Frame Render"`;

// App start operation rows need a second compatibility layer. In the legacy shape,
// contributing operations are child spans under a ui.load/navigation transaction;
// the display name lives in span.description, cold/warm uses app_start_type, and
// has:ttid scopes the rows to app-start traces. In the newer shape, operation spans
// are standalone non-transaction spans; display names moved to span.name and
// cold/warm uses app.vitals.start.type. Those children do not carry
// app.vitals.start.screen (parent-only); dashboardFiltersToString ORs the
// screen filter with transaction so V1 / ui.load-attached children still match.
const APP_START_SPAN_NAME_OR_DESCRIPTION_CONDITION = `((has:${SpanFields.SPAN_DESCRIPTION} ${APP_START_DESCRIPTION_EXCLUSIONS}) OR (has:${SpanFields.NAME} ${APP_START_NAME_EXCLUSIONS}))`;
const COLD_START_V1_OPERATIONS_CONDITION = `${APP_START_DESCRIPTION_EXCLUSIONS} has:${SpanFields.SPAN_DESCRIPTION} ${TRANSACTION_OP_CONDITION} has:ttid ${SpanFields.APP_START_TYPE}:cold ${APP_START_OPERATIONS}`;
const COLD_START_V2_OPERATIONS_CONDITION = `!${SpanFields.IS_TRANSACTION}:true ${APP_START_SPAN_NAME_OR_DESCRIPTION_CONDITION} ${SpanFields.APP_VITALS_START_TYPE}:cold ${APP_START_OPERATIONS}`;
export const COLD_START_TABLE_OPERATIONS_CONDITION = `(${COLD_START_V1_OPERATIONS_CONDITION} OR ${COLD_START_V2_OPERATIONS_CONDITION})`;

const WARM_START_V1_OPERATIONS_CONDITION = `${APP_START_DESCRIPTION_EXCLUSIONS} has:${SpanFields.SPAN_DESCRIPTION} ${TRANSACTION_OP_CONDITION} has:ttid ${SpanFields.APP_START_TYPE}:warm ${APP_START_OPERATIONS}`;
const WARM_START_V2_OPERATIONS_CONDITION = `!${SpanFields.IS_TRANSACTION}:true ${APP_START_SPAN_NAME_OR_DESCRIPTION_CONDITION} ${SpanFields.APP_VITALS_START_TYPE}:warm ${APP_START_OPERATIONS}`;
export const WARM_START_TABLE_OPERATIONS_CONDITION = `(${WARM_START_V1_OPERATIONS_CONDITION} OR ${WARM_START_V2_OPERATIONS_CONDITION})`;

// Screen load operation rows have the same naming split: legacy spans populate
// span.description, while newer span data populates span.name. Include both fields
// so the operations table can group rows during the migration.
const SCREEN_LOAD_SPAN_NAME_OR_DESCRIPTION_CONDITION = `(has:${SpanFields.SPAN_DESCRIPTION} OR has:${SpanFields.NAME})`;
export const SCREEN_LOAD_SPAN_OPERATIONS_CONDITION = `${TRANSACTION_OP_CONDITION} ${SCREEN_LOAD_SPAN_NAME_OR_DESCRIPTION_CONDITION} ${SpanFields.SPAN_OP}:[file.read,file.write,ui.load,navigation,http.client,db,db.sql.room,db.sql.query,db.sql.transaction]`;
