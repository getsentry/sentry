import zipfile
from io import BytesIO
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.models.debugfile import ProjectDebugFile
from sentry.models.files.file import File
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.relay import RelayStoreHelper
from sentry.testutils.skips import requires_symbolicator
from sentry.utils import json

PROGUARD_UUID = "6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1"
PROGUARD_SOURCE = b"""\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
    65:65:void <init>() -> <init>
    67:67:java.lang.Class[] getClassContext() -> a
    69:69:java.lang.Class[] getExtraClassContext() -> a
    68:68:java.lang.Class[] getContext() -> a
    65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
org.slf4j.helpers.Util$ClassContext -> org.a.b.g$b:
    65:65:void <init>() -> <init>
"""
PROGUARD_INLINE_UUID = "d748e578-b3d1-5be5-b0e5-a42e8c9bf8e0"
PROGUARD_INLINE_SOURCE = b"""\
# compiler: R8
# compiler_version: 2.0.74
# min_api: 16
# pg_map_id: 5b46fdc
# common_typos_disable
$r8$backportedMethods$utility$Objects$2$equals -> a:
    boolean equals(java.lang.Object,java.lang.Object) -> a
$r8$twr$utility -> b:
    void $closeResource(java.lang.Throwable,java.lang.Object) -> a
android.support.v4.app.RemoteActionCompatParcelizer -> android.support.v4.app.RemoteActionCompatParcelizer:
    1:1:void <init>():11:11 -> <init>
io.sentry.sample.-$$Lambda$r3Avcbztes2hicEObh02jjhQqd4 -> e.a.c.a:
    io.sentry.sample.MainActivity f$0 -> b
io.sentry.sample.MainActivity -> io.sentry.sample.MainActivity:
    1:1:void <init>():15:15 -> <init>
    1:1:boolean onCreateOptionsMenu(android.view.Menu):60:60 -> onCreateOptionsMenu
    1:1:boolean onOptionsItemSelected(android.view.MenuItem):69:69 -> onOptionsItemSelected
    2:2:boolean onOptionsItemSelected(android.view.MenuItem):76:76 -> onOptionsItemSelected
    1:1:void bar():54:54 -> t
    1:1:void foo():44 -> t
    1:1:void onClickHandler(android.view.View):40 -> t
"""
PROGUARD_BUG_UUID = "071207ac-b491-4a74-957c-2c94fd9594f2"
PROGUARD_BUG_SOURCE = b"x"

JVM_DEBUG_ID = "6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1"
JVM_SOURCE = b"""\
package io.sentry.samples

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        InnerClass().whoops()

        val list = findViewById<RecyclerView>(R.id.list)
        list.layoutManager = LinearLayoutManager(this)
        list.adapter = TrackAdapter()
    }

    class InnerClass {
        fun whoops() {
            AnotherInnerClass().whoops2()
        }
    }

    class AnotherInnerClass {
        fun whoops2() {
            AdditionalInnerClass().whoops3()
        }
    }

    class AdditionalInnerClass {
        fun whoops3() {
            OneMoreInnerClass().whoops4()
        }
    }

    class OneMoreInnerClass {
        fun whoops4() {
            throw RuntimeException("whoops")
        }
    }
}

"""

PROGUARD_SOURCE_LOOKUP_UUID = "05d96b1c-1786-477c-8615-d3cf83e027c7"
PROGUARD_SOURCE_LOOKUP_SOURCE = b"""\
io.sentry.samples.instrumentation.ui.EditActivity -> io.sentry.samples.instrumentation.ui.EditActivity:
# {"id":"sourceFile","fileName":"EditActivity.kt"}
    int $r8$clinit -> a
    0:65535:void <init>():15:15 -> <init>
    1:6:void onCreate(android.os.Bundle):18:18 -> onCreate
    7:12:void onCreate(android.os.Bundle):19:19 -> onCreate
    13:22:void onCreate(android.os.Bundle):21:21 -> onCreate
    23:32:void onCreate(android.os.Bundle):22:22 -> onCreate
    33:42:void onCreate(android.os.Bundle):23:23 -> onCreate
    43:49:void onCreate(android.os.Bundle):24:24 -> onCreate
    50:71:void onCreate(android.os.Bundle):26:26 -> onCreate
    72:73:java.lang.String io.sentry.samples.instrumentation.data.Track.getName():46:46 -> onCreate
    72:73:void onCreate(android.os.Bundle):28 -> onCreate
    74:76:void onCreate(android.os.Bundle):28:28 -> onCreate
    77:78:java.lang.String io.sentry.samples.instrumentation.data.Track.getComposer():48:48 -> onCreate
    77:78:void onCreate(android.os.Bundle):29 -> onCreate
    79:81:void onCreate(android.os.Bundle):29:29 -> onCreate
    82:83:long io.sentry.samples.instrumentation.data.Track.getMillis():51:51 -> onCreate
    82:83:void onCreate(android.os.Bundle):30 -> onCreate
    84:90:void onCreate(android.os.Bundle):30:30 -> onCreate
    91:92:float io.sentry.samples.instrumentation.data.Track.getPrice():53:53 -> onCreate
    91:92:void onCreate(android.os.Bundle):31 -> onCreate
    93:102:void onCreate(android.os.Bundle):31:31 -> onCreate
    103:119:void onCreate(android.os.Bundle):34:34 -> onCreate
io.sentry.samples.instrumentation.ui.EditActivity$$ExternalSyntheticLambda0 -> io.sentry.samples.instrumentation.ui.g:
# {"id":"sourceFile","fileName":"R8$$SyntheticClass"}
# {"id":"com.android.tools.r8.synthesized"}
    android.widget.EditText io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.f$4 -> e
    android.widget.EditText io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.f$3 -> d
    android.widget.EditText io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.f$2 -> c
    io.sentry.samples.instrumentation.data.Track io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.f$0 -> a
    android.widget.EditText io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.f$1 -> b
    io.sentry.samples.instrumentation.ui.EditActivity io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.f$5 -> f
    void io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.<init>(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity) -> <init>
      # {"id":"com.android.tools.r8.synthesized"}
    19:21:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):0:0 -> onMenuItemClick
    19:21:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    22:35:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):35:35 -> onMenuItemClick
    22:35:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    36:44:void io.sentry.samples.instrumentation.ui.AnotherClassInSameFile$AnotherInnerClass.helloOtherInner():26:26 -> onMenuItemClick
    36:44:void io.sentry.samples.instrumentation.ui.AnotherClassInSameFile.otherFun():21 -> onMenuItemClick
    36:44:void io.sentry.samples.instrumentation.ui.AnotherClassInSameFile.helloOther():17 -> onMenuItemClick
    36:44:void io.sentry.samples.instrumentation.ui.SomeService$InnerClassOfSomeService.helloInner():10 -> onMenuItemClick
    36:44:void io.sentry.samples.instrumentation.ui.SomeService.helloThere():5 -> onMenuItemClick
    36:44:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):37 -> onMenuItemClick
    36:44:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    45:58:io.sentry.protocol.SentryId io.sentry.Sentry.captureException(java.lang.Throwable):433:433 -> onMenuItemClick
    45:58:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):39 -> onMenuItemClick
    45:58:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    59:68:io.sentry.ITransaction io.sentry.Sentry.startTransaction(java.lang.String,java.lang.String,boolean):697:697 -> onMenuItemClick
    59:68:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):42 -> onMenuItemClick
    59:68:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    69:71:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):42:42 -> onMenuItemClick
    69:71:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    72:79:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):48:48 -> onMenuItemClick
    72:79:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    80:87:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):49:49 -> onMenuItemClick
    80:87:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    88:95:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):50:50 -> onMenuItemClick
    88:95:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    96:103:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):51:51 -> onMenuItemClick
    96:103:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    104:125:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):52:52 -> onMenuItemClick
    104:125:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    126:142:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):53:53 -> onMenuItemClick
    126:142:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    143:164:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):54:54 -> onMenuItemClick
    143:164:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    165:175:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):64:64 -> onMenuItemClick
    165:175:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    176:187:void io.sentry.samples.instrumentation.ui.EditActivity.addNewTrack(java.lang.String,java.lang.String,long,float):84:84 -> onMenuItemClick
    176:187:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):64 -> onMenuItemClick
    176:187:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    188:190:void io.sentry.samples.instrumentation.data.Track.<init>(long,java.lang.String,java.lang.Long,java.lang.String,java.lang.Long,java.lang.Long,long,java.lang.Long,float,int,kotlin.jvm.internal.DefaultConstructorMarker):43:43 -> onMenuItemClick
    188:190:void io.sentry.samples.instrumentation.ui.EditActivity.addNewTrack(java.lang.String,java.lang.String,long,float):84 -> onMenuItemClick
    188:190:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):64 -> onMenuItemClick
    188:190:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    191:198:void io.sentry.samples.instrumentation.ui.EditActivity.addNewTrack(java.lang.String,java.lang.String,long,float):94:94 -> onMenuItemClick
    191:198:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):64 -> onMenuItemClick
    191:198:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    199:211:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):66:66 -> onMenuItemClick
    199:211:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    212:227:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):67:67 -> onMenuItemClick
    212:227:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    228:238:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):69:69 -> onMenuItemClick
    228:238:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    239:250:io.sentry.samples.instrumentation.data.Track io.sentry.samples.instrumentation.data.Track.copy$default(io.sentry.samples.instrumentation.data.Track,long,java.lang.String,java.lang.Long,java.lang.String,java.lang.Long,java.lang.Long,long,java.lang.Long,float,int,java.lang.Object):0:0 -> onMenuItemClick
    239:250:void io.sentry.samples.instrumentation.ui.EditActivity.update(io.sentry.samples.instrumentation.data.Track,java.lang.String,java.lang.String,long,float):100 -> onMenuItemClick
    239:250:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):69 -> onMenuItemClick
    239:250:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    251:265:io.sentry.samples.instrumentation.data.Track io.sentry.samples.instrumentation.data.Track.copy(long,java.lang.String,java.lang.Long,java.lang.String,java.lang.Long,java.lang.Long,long,java.lang.Long,float):0:0 -> onMenuItemClick
    251:265:io.sentry.samples.instrumentation.data.Track io.sentry.samples.instrumentation.data.Track.copy$default(io.sentry.samples.instrumentation.data.Track,long,java.lang.String,java.lang.Long,java.lang.String,java.lang.Long,java.lang.Long,long,java.lang.Long,float,int,java.lang.Object):0 -> onMenuItemClick
    251:265:void io.sentry.samples.instrumentation.ui.EditActivity.update(io.sentry.samples.instrumentation.data.Track,java.lang.String,java.lang.String,long,float):100 -> onMenuItemClick
    251:265:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):69 -> onMenuItemClick
    251:265:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    266:273:void io.sentry.samples.instrumentation.ui.EditActivity.update(io.sentry.samples.instrumentation.data.Track,java.lang.String,java.lang.String,long,float):106:106 -> onMenuItemClick
    266:273:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):69 -> onMenuItemClick
    266:273:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    274:286:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):71:71 -> onMenuItemClick
    274:286:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    287:301:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):72:72 -> onMenuItemClick
    287:301:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    302:306:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):74:74 -> onMenuItemClick
    302:306:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    307:312:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):75:75 -> onMenuItemClick
    307:312:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    313:316:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):56:56 -> onMenuItemClick
    313:316:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
    317:320:boolean io.sentry.samples.instrumentation.ui.EditActivity.onCreate$lambda-1(io.sentry.samples.instrumentation.data.Track,android.widget.EditText,android.widget.EditText,android.widget.EditText,android.widget.EditText,io.sentry.samples.instrumentation.ui.EditActivity,android.view.MenuItem):61:61 -> onMenuItemClick
    317:320:boolean io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0.onMenuItemClick(android.view.MenuItem):0 -> onMenuItemClick
      # {"id":"com.android.tools.r8.synthesized"}
"""

EDIT_ACTIVITY_SOURCE = b"""\
package io.sentry.samples.instrumentation.ui

import android.os.Bundle
import android.widget.EditText
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.appcompat.widget.Toolbar
import io.sentry.Sentry
import io.sentry.SpanStatus
import io.sentry.samples.instrumentation.R
import io.sentry.samples.instrumentation.SampleApp
import io.sentry.samples.instrumentation.data.Track
import kotlinx.coroutines.runBlocking

class EditActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_edit)

        val nameInput = findViewById<EditText>(R.id.track_name)
        val composerInput = findViewById<EditText>(R.id.track_composer)
        val durationInput = findViewById<EditText>(R.id.track_duration)
        val unitPriceInput = findViewById<EditText>(R.id.track_unit_price)

        val originalTrack: Track? = intent.getSerializableExtra(TRACK_EXTRA_KEY) as? Track
        originalTrack?.run {
            nameInput.setText(name)
            composerInput.setText(composer)
            durationInput.setText(millis.toString())
            unitPriceInput.setText(price.toString())
        }

        findViewById<Toolbar>(R.id.toolbar).setOnMenuItemClickListener {
            if (it.itemId == R.id.action_save) {
                try {
                    SomeService().helloThere()
                } catch (e: Exception) {
                    Sentry.captureException(e)
                }

                val transaction = Sentry.startTransaction(
                    "Track Interaction",
                    if (originalTrack == null) "ui.action.add" else "ui.action.edit",
                    true
                )

                val name = nameInput.text.toString()
                val composer = composerInput.text.toString()
                val duration = durationInput.text.toString()
                val unitPrice = unitPriceInput.text.toString()
                if (name.isEmpty() || composer.isEmpty() ||
                    duration.isEmpty() || duration.toLongOrNull() == null ||
                    unitPrice.isEmpty() || unitPrice.toFloatOrNull() == null
                ) {
                    Toast.makeText(
                        this,
                        "Some of the inputs are empty or have wrong format " +
                            "(duration/unitprice not a number)",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    if (originalTrack == null) {
                        addNewTrack(name, composer, duration.toLong(), unitPrice.toFloat())

                        val createCount = SampleApp.analytics.getInt("create_count", 0) + 1
                        SampleApp.analytics.edit().putInt("create_count", createCount).apply()
                    } else {
                        originalTrack.update(name, composer, duration.toLong(), unitPrice.toFloat())

                        val editCount = SampleApp.analytics.getInt("edit_count", 0) + 1
                        SampleApp.analytics.edit().putInt("edit_count", editCount).apply()
                    }
                    transaction.finish(SpanStatus.OK)
                    finish()
                }
                return@setOnMenuItemClickListener true
            }
            return@setOnMenuItemClickListener false
        }
    }

    private fun addNewTrack(name: String, composer: String, duration: Long, unitPrice: Float) {
        val newTrack = Track(
            name = name,
            albumId = null,
            composer = composer,
            mediaTypeId = null,
            genreId = null,
            millis = duration,
            bytes = null,
            price = unitPrice
        )
        runBlocking {
            SampleApp.database.tracksDao().insert(newTrack)
        }
    }

    private fun Track.update(name: String, composer: String, duration: Long, unitPrice: Float) {
        val updatedTrack = copy(
            name = name,
            composer = composer,
            millis = duration,
            price = unitPrice
        )
        runBlocking {
            SampleApp.database.tracksDao().update(updatedTrack)
        }
    }

    companion object {
        const val TRACK_EXTRA_KEY = "EditActivity.Track"
    }
}

"""

SOME_SERVICE_SOURCE = b"""\
package io.sentry.samples.instrumentation.ui

class SomeService {
    fun helloThere() {
        InnerClassOfSomeService().helloInner()
    }

    class InnerClassOfSomeService {
        fun helloInner() {
            AnotherClassInSameFile().helloOther()
        }
    }
}

class AnotherClassInSameFile {
    fun helloOther() {
        otherFun()
    }

    private fun otherFun() {
        AnotherInnerClass().helloOtherInner()
    }

    class AnotherInnerClass {
        fun helloOtherInner() {
            throw RuntimeException("thrown on purpose to test ProGuard Android source context")
        }
    }
}

"""


@pytest.mark.django_db(transaction=True)
class BasicResolvingIntegrationTest(RelayStoreHelper, TransactionTestCase):
    @pytest.fixture(autouse=True)
    def initialize(self, set_sentry_option, live_server):
        with set_sentry_option("system.url-prefix", live_server.url):
            # Run test case
            yield

    def upload_proguard_mapping(self, uuid, mapping_file_content):
        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, "w")
        f.writestr("proguard/%s.txt" % uuid, mapping_file_content)
        f.writestr("ignored-file.txt", b"This is just some stuff")
        f.close()

        response = self.client.post(
            url,
            {
                "file": SimpleUploadedFile(
                    "symbols.zip", out.getvalue(), content_type="application/zip"
                )
            },
            format="multipart",
        )

        assert response.status_code == 201, response.content
        assert len(response.json()) == 1

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_basic_resolving(self):
        self.upload_proguard_mapping(PROGUARD_UUID, PROGUARD_SOURCE)

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 67,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 69,
                                },
                            ]
                        },
                        "module": "org.a.b",
                        "type": "g$a",
                        "value": "Attempt to invoke virtual method 'org.a.b.g$a.a' on a null object reference",
                    }
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        if not self.use_relay():
            # We measure the number of queries after an initial post,
            # because there are many queries polluting the array
            # before the actual "processing" happens (like, auth_user)
            with self.assertWriteQueries(
                {
                    "nodestore_node": 2,
                    "sentry_eventuser": 1,
                    "sentry_groupedmessage": 1,
                    "sentry_userreport": 1,
                }
            ):
                self.post_and_retrieve_event(event_data)

        exc = event.interfaces["exception"].values[0]
        bt = exc.stacktrace
        frames = bt.frames

        assert exc.type == "Util$ClassContextSecurityManager"
        assert (
            exc.value
            == "Attempt to invoke virtual method 'org.slf4j.helpers.Util$ClassContextSecurityManager.getExtraClassContext' on a null object reference"
        )
        assert exc.module == "org.slf4j.helpers"
        assert frames[0].function == "getClassContext"
        assert frames[0].module == "org.slf4j.helpers.Util$ClassContextSecurityManager"
        assert frames[1].function == "getExtraClassContext"
        assert frames[1].module == "org.slf4j.helpers.Util$ClassContextSecurityManager"

        assert event.culprit == (
            "org.slf4j.helpers.Util$ClassContextSecurityManager " "in getExtraClassContext"
        )

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_resolving_does_not_fail_when_no_value(self):
        self.upload_proguard_mapping(PROGUARD_UUID, PROGUARD_SOURCE)

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 67,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 69,
                                },
                            ]
                        },
                        "module": "org.a.b",
                        "type": "g$a",
                    }
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        if not self.use_relay():
            # We measure the number of queries after an initial post,
            # because there are many queries polluting the array
            # before the actual "processing" happens (like, auth_user)
            with self.assertWriteQueries(
                {
                    "nodestore_node": 2,
                    "sentry_eventuser": 1,
                    "sentry_groupedmessage": 1,
                    "sentry_userreport": 1,
                }
            ):
                self.post_and_retrieve_event(event_data)

        metrics = event.data["_metrics"]
        assert not metrics.get("flag.processing.error")

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_resolving_does_not_fail_when_no_module_or_function(self):
        self.upload_proguard_mapping(PROGUARD_UUID, PROGUARD_SOURCE)

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 67,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 69,
                                },
                                {
                                    "function": "__start_thread",
                                    "package": "/apex/com.android.art/lib64/libart.so",
                                    "lineno": 196,
                                    "in_app": False,
                                },
                                {
                                    "package": "/apex/com.android.art/lib64/libart.so",
                                    "lineno": 214,
                                    "in_app": False,
                                },
                            ]
                        },
                        "module": "org.a.b",
                        "type": "g$a",
                        "value": "Attempt to invoke virtual method 'org.a.b.g$a.a' on a null object reference",
                    }
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        if not self.use_relay():
            # We measure the number of queries after an initial post,
            # because there are many queries polluting the array
            # before the actual "processing" happens (like, auth_user)
            with self.assertWriteQueries(
                {
                    "nodestore_node": 2,
                    "sentry_eventuser": 1,
                    "sentry_groupedmessage": 1,
                    "sentry_userreport": 1,
                }
            ):
                self.post_and_retrieve_event(event_data)

        metrics = event.data["_metrics"]
        assert not metrics.get("flag.processing.error")

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_sets_inapp_after_resolving(self):
        self.upload_proguard_mapping(PROGUARD_UUID, PROGUARD_SOURCE)

        version = "org.slf4j@1.2.3"
        env_name = "some_env"
        event = self.store_event(
            data={"release": version, "environment": env_name}, project_id=self.project.id
        )

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "release": "org.slf4j@1.2.3",
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 67,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 69,
                                    "in_app": False,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 68,
                                    "in_app": True,
                                },
                                {
                                    "function": "init",
                                    "abs_path": None,
                                    "module": "com.android.Zygote",
                                    "filename": None,
                                    "lineno": 62,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$b",
                                    "filename": None,
                                    "lineno": 70,
                                },
                            ]
                        },
                        "module": "org.a.b",
                        "type": "g$a",
                        "value": "Attempt to invoke virtual method 'org.a.b.g$a.a' on a null object reference",
                    }
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        if not self.use_relay():
            # We measure the number of queries after an initial post,
            # because there are many queries polluting the array
            # before the actual "processing" happens (like, auth_user)
            with self.assertWriteQueries(
                {
                    "nodestore_node": 2,
                    "sentry_eventuser": 1,
                    "sentry_groupedmessage": 1,
                    "sentry_userreport": 1,
                }
            ):
                self.post_and_retrieve_event(event_data)

        exc = event.interfaces["exception"].values[0]
        bt = exc.stacktrace
        frames = bt.frames

        assert exc.module == "org.slf4j.helpers"
        assert frames[0].in_app is True
        assert frames[1].in_app is False
        assert frames[2].in_app is True
        assert frames[3].in_app is False
        assert frames[4].in_app is True

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_resolving_inline(self):
        self.upload_proguard_mapping(PROGUARD_INLINE_UUID, PROGUARD_INLINE_SOURCE)

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_INLINE_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "onClick",
                                    "abs_path": None,
                                    "module": "e.a.c.a",
                                    "filename": None,
                                    "lineno": 2,
                                },
                                {
                                    "function": "t",
                                    "abs_path": None,
                                    "module": "io.sentry.sample.MainActivity",
                                    "filename": "MainActivity.java",
                                    "lineno": 1,
                                },
                            ]
                        },
                        "module": "org.a.b",
                        "type": "g$a",
                        "value": "Oh no",
                    }
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        if not self.use_relay():
            # We measure the number of queries after an initial post,
            # because there are many queries polluting the array
            # before the actual "processing" happens (like, auth_user)
            with self.assertWriteQueries(
                {
                    "nodestore_node": 2,
                    "sentry_eventuser": 1,
                    "sentry_groupedmessage": 1,
                    "sentry_userreport": 1,
                }
            ):
                self.post_and_retrieve_event(event_data)

        exc = event.interfaces["exception"].values[0]
        bt = exc.stacktrace
        frames = bt.frames

        assert len(frames) == 4

        assert frames[0].function == "onClick"
        assert frames[0].module == "io.sentry.sample.-$$Lambda$r3Avcbztes2hicEObh02jjhQqd4"

        assert frames[1].filename == "MainActivity.java"
        assert frames[1].module == "io.sentry.sample.MainActivity"
        assert frames[1].function == "onClickHandler"
        assert frames[1].lineno == 40
        assert frames[2].function == "foo"
        assert frames[2].lineno == 44
        assert frames[3].function == "bar"
        assert frames[3].lineno == 54
        assert frames[3].filename == "MainActivity.java"
        assert frames[3].module == "io.sentry.sample.MainActivity"

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_resolving_inline_with_native_frames(self):
        self.upload_proguard_mapping(PROGUARD_INLINE_UUID, PROGUARD_INLINE_SOURCE)

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_INLINE_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "onClick",
                                    "abs_path": None,
                                    "module": "e.a.c.a",
                                    "filename": None,
                                    "lineno": 2,
                                },
                                {
                                    "function": "t",
                                    "abs_path": None,
                                    "module": "io.sentry.sample.MainActivity",
                                    "filename": "MainActivity.java",
                                    "lineno": 1,
                                },
                                {
                                    "abs_path": "Thread.java",
                                    "filename": "Thread.java",
                                    "function": "sleep",
                                    "lineno": 450,
                                    "lock": {
                                        "address": "0x0ddc1f22",
                                        "class_name": "Object",
                                        "package_name": "java.lang",
                                        "type:": 1,
                                    },
                                    "module": "java.lang.Thread",
                                },
                                {
                                    "function": "__start_thread",
                                    "package": "/apex/com.android.art/lib64/libart.so",
                                    "lineno": 196,
                                    "in_app": False,
                                },
                            ]
                        },
                        "module": "org.a.b",
                        "type": "g$a",
                        "value": "Oh no",
                    }
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        if not self.use_relay():
            # We measure the number of queries after an initial post,
            # because there are many queries polluting the array
            # before the actual "processing" happens (like, auth_user)
            with self.assertWriteQueries(
                {
                    "nodestore_node": 2,
                    "sentry_eventuser": 1,
                    "sentry_groupedmessage": 1,
                    "sentry_userreport": 1,
                }
            ):
                self.post_and_retrieve_event(event_data)

        exc = event.interfaces["exception"].values[0]
        bt = exc.stacktrace
        frames = bt.frames

        assert len(frames) == 6

        assert frames[0].function == "onClick"
        assert frames[0].module == "io.sentry.sample.-$$Lambda$r3Avcbztes2hicEObh02jjhQqd4"

        assert frames[1].filename == "MainActivity.java"
        assert frames[1].module == "io.sentry.sample.MainActivity"
        assert frames[1].function == "onClickHandler"
        assert frames[1].lineno == 40
        assert frames[2].function == "foo"
        assert frames[2].lineno == 44
        assert frames[3].function == "bar"
        assert frames[3].lineno == 54
        assert frames[3].filename == "MainActivity.java"
        assert frames[3].module == "io.sentry.sample.MainActivity"
        assert frames[4].function == "sleep"
        assert frames[4].lineno == 450
        assert frames[4].filename == "Thread.java"
        assert frames[4].module == "java.lang.Thread"
        assert frames[5].function == "__start_thread"
        assert frames[5].package == "/apex/com.android.art/lib64/libart.so"

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_error_on_resolving(self):
        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, "w")
        f.writestr("proguard/%s.txt" % PROGUARD_BUG_UUID, PROGUARD_BUG_SOURCE)
        f.close()

        response = self.client.post(
            url,
            {
                "file": SimpleUploadedFile(
                    "symbols.zip", out.getvalue(), content_type="application/zip"
                )
            },
            format="multipart",
        )
        assert response.status_code == 201, response.content
        assert len(response.json()) == 1

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_BUG_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 67,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 69,
                                },
                            ]
                        },
                        "type": "RuntimeException",
                        "value": "Oh no",
                    }
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)

        assert len(event.data["errors"]) == 1
        error = event.data["errors"][0]
        assert error["mapping_uuid"] == "071207ac-b491-4a74-957c-2c94fd9594f2"
        assert error["type"] == "proguard_missing_lineno"

    def upload_jvm_bundle(self, debug_id, source_files):
        files = {}

        for source_file in source_files:
            files[f"files/_/_/{source_file}"] = {"url": f"~/{source_file}"}

        manifest = {
            "org": self.project.organization.slug,
            "project": self.project.slug,
            "debug_id": debug_id,
            "files": files,
        }

        file_like = BytesIO(b"SYSB")
        with zipfile.ZipFile(file_like, "a") as zip:
            for path, contents in source_files.items():
                zip.writestr(f"files/_/_/{path}", contents)
            zip.writestr("manifest.json", json.dumps(manifest))
        file_like.seek(0)

        file = File.objects.create(
            name="bundle.zip",
            type="sourcebundle",
            headers={"Content-Type": "application/x-sentry-bundle+zip"},
        )
        file.putfile(file_like)

        ProjectDebugFile.objects.create(
            project_id=self.project.id,
            debug_id=debug_id,
            file=file,
        )

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_basic_source_lookup(self):
        debug_id = str(uuid4())
        self.upload_jvm_bundle(debug_id, {"io/sentry/samples/MainActivity.jvm": JVM_SOURCE})

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "jvm", "debug_id": debug_id}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "otherMethod",
                                    "abs_path": "OtherActivity.java",
                                    "module": "OtherActivity",
                                    "filename": "OtherActivity.java",
                                    "lineno": 100,
                                },
                                {
                                    "function": "differentMethod",
                                    "abs_path": "DifferentActivity",
                                    "module": "DifferentActivity",
                                    "filename": "DifferentActivity",
                                    "lineno": 200,
                                },
                                {
                                    "function": "onCreate",
                                    "abs_path": None,
                                    "module": "io.sentry.samples.MainActivity",
                                    "filename": None,
                                    "lineno": 11,
                                },
                                {
                                    "function": "whoops",
                                    "abs_path": "MainActivity.kt",
                                    "module": "io.sentry.samples.MainActivity$InnerClass",
                                    "filename": "MainActivity.kt",
                                    "lineno": 20,
                                },
                                {
                                    "function": "whoops2",
                                    "abs_path": None,
                                    "module": "io.sentry.samples.MainActivity$AnotherInnerClass",
                                    "filename": None,
                                    "lineno": 26,
                                },
                                {
                                    "function": "whoops3",
                                    "abs_path": "MainActivity.kt",
                                    "module": "io.sentry.samples.MainActivity$AdditionalInnerClass",
                                    "filename": "MainActivity.kt",
                                    "lineno": 32,
                                },
                                {
                                    "function": "whoops4",
                                    "abs_path": "SourceFile",
                                    "module": "io.sentry.samples.MainActivity$OneMoreInnerClass",
                                    "filename": "SourceFile",
                                    "lineno": 38,
                                },
                            ]
                        },
                        "module": "io.sentry.samples",
                        "type": "RuntimeException",
                        "value": "whoops",
                    }
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        if not self.use_relay():
            # We measure the number of queries after an initial post,
            # because there are many queries polluting the array
            # before the actual "processing" happens (like, auth_user)
            with self.assertWriteQueries(
                {
                    "nodestore_node": 2,
                    "sentry_eventuser": 1,
                    "sentry_groupedmessage": 1,
                    "sentry_userreport": 1,
                }
            ):
                self.post_and_retrieve_event(event_data)

        exc = event.interfaces["exception"].values[0]
        bt = exc.stacktrace
        frames = bt.frames

        assert exc.type == "RuntimeException"
        assert exc.value == "whoops"
        assert exc.module == "io.sentry.samples"

        assert frames[0].function == "otherMethod"
        assert frames[0].module == "OtherActivity"
        assert frames[0].lineno == 100
        assert frames[0].context_line is None
        assert frames[0].pre_context is None
        assert frames[0].post_context is None

        assert frames[1].function == "differentMethod"
        assert frames[1].module == "DifferentActivity"
        assert frames[1].lineno == 200
        assert frames[1].context_line is None
        assert frames[1].pre_context is None
        assert frames[1].post_context is None

        assert frames[2].function == "onCreate"
        assert frames[2].module == "io.sentry.samples.MainActivity"
        assert frames[2].lineno == 11
        assert frames[2].context_line == "        InnerClass().whoops()"
        assert frames[2].pre_context == [
            "",
            "class MainActivity : ComponentActivity() {",
            "    override fun onCreate(savedInstanceState: Bundle?) {",
            "        super.onCreate(savedInstanceState)",
            "        setContentView(R.layout.activity_main)",
        ]
        assert frames[2].post_context == [
            "",
            "        val list = findViewById<RecyclerView>(R.id.list)",
            "        list.layoutManager = LinearLayoutManager(this)",
            "        list.adapter = TrackAdapter()",
            "    }",
        ]

        assert frames[3].function == "whoops"
        assert frames[3].module == "io.sentry.samples.MainActivity$InnerClass"
        assert frames[3].lineno == 20
        assert frames[3].context_line == "            AnotherInnerClass().whoops2()"
        assert frames[3].pre_context == [
            "        list.adapter = TrackAdapter()",
            "    }",
            "",
            "    class InnerClass {",
            "        fun whoops() {",
        ]
        assert frames[3].post_context == [
            "        }",
            "    }",
            "",
            "    class AnotherInnerClass {",
            "        fun whoops2() {",
        ]

        assert frames[4].function == "whoops2"
        assert frames[4].module == "io.sentry.samples.MainActivity$AnotherInnerClass"
        assert frames[4].lineno == 26
        assert frames[4].context_line == "            AdditionalInnerClass().whoops3()"
        assert frames[4].pre_context == [
            "        }",
            "    }",
            "",
            "    class AnotherInnerClass {",
            "        fun whoops2() {",
        ]
        assert frames[4].post_context == [
            "        }",
            "    }",
            "",
            "    class AdditionalInnerClass {",
            "        fun whoops3() {",
        ]

        assert frames[5].function == "whoops3"
        assert frames[5].module == "io.sentry.samples.MainActivity$AdditionalInnerClass"
        assert frames[5].lineno == 32
        assert frames[5].context_line == "            OneMoreInnerClass().whoops4()"
        assert frames[5].pre_context == [
            "        }",
            "    }",
            "",
            "    class AdditionalInnerClass {",
            "        fun whoops3() {",
        ]
        assert frames[5].post_context == [
            "        }",
            "    }",
            "",
            "    class OneMoreInnerClass {",
            "        fun whoops4() {",
        ]

        assert frames[6].function == "whoops4"
        assert frames[6].module == "io.sentry.samples.MainActivity$OneMoreInnerClass"
        assert frames[6].lineno == 38
        assert frames[6].context_line == '            throw RuntimeException("whoops")'
        assert frames[6].pre_context == [
            "        }",
            "    }",
            "",
            "    class OneMoreInnerClass {",
            "        fun whoops4() {",
        ]
        assert frames[6].post_context == ["        }", "    }", "}", ""]

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_source_lookup_with_proguard(self):
        self.upload_proguard_mapping(PROGUARD_SOURCE_LOOKUP_UUID, PROGUARD_SOURCE_LOOKUP_SOURCE)
        debug_id1 = str(uuid4())
        self.upload_jvm_bundle(
            debug_id1,
            {
                "io/sentry/samples/instrumentation/ui/EditActivity.jvm": EDIT_ACTIVITY_SOURCE,
            },
        )
        debug_id2 = str(uuid4())
        self.upload_jvm_bundle(
            debug_id2,
            {
                "io/sentry/samples/instrumentation/ui/SomeService.jvm": SOME_SERVICE_SOURCE,
            },
        )

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {
                "images": [
                    {
                        "type": "jvm",
                        "debug_id": debug_id1,
                    },
                    {
                        "type": "jvm",
                        "debug_id": debug_id2,
                    },
                    {
                        "type": "jvm",
                        "debug_id": str(uuid4()),
                    },  # does not exist
                    {"type": "proguard", "uuid": PROGUARD_SOURCE_LOOKUP_UUID},
                    {"type": "proguard", "uuid": str(uuid4())},  # does not exist
                ]
            },
            "exception": {
                "values": [
                    {
                        "type": "RuntimeException",
                        "value": "thrown on purpose to test ProGuard Android source context",
                        "module": "java.lang",
                        "thread_id": 1,
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "ZygoteInit.java",
                                    "function": "main",
                                    "module": "com.android.internal.os.ZygoteInit",
                                    "lineno": 698,
                                    "native": False,
                                },
                                {
                                    "filename": "ZygoteInit.java",
                                    "function": "run",
                                    "module": "com.android.internal.os.ZygoteInit$MethodAndArgsCaller",
                                    "lineno": 903,
                                    "native": False,
                                },
                                {
                                    "filename": "Method.java",
                                    "function": "invoke",
                                    "module": "java.lang.reflect.Method",
                                    "lineno": 372,
                                    "native": False,
                                },
                                {
                                    "filename": "Method.java",
                                    "function": "invoke",
                                    "module": "java.lang.reflect.Method",
                                    "native": True,
                                },
                                {
                                    "filename": "ActivityThread.java",
                                    "function": "main",
                                    "module": "android.app.ActivityThread",
                                    "lineno": 5254,
                                    "native": False,
                                },
                                {
                                    "filename": "Looper.java",
                                    "function": "loop",
                                    "module": "android.os.Looper",
                                    "lineno": 135,
                                    "native": False,
                                },
                                {
                                    "filename": "Handler.java",
                                    "function": "dispatchMessage",
                                    "module": "android.os.Handler",
                                    "lineno": 95,
                                    "native": False,
                                },
                                {
                                    "filename": "Handler.java",
                                    "function": "handleCallback",
                                    "module": "android.os.Handler",
                                    "lineno": 739,
                                    "native": False,
                                },
                                {
                                    "filename": "View.java",
                                    "function": "run",
                                    "module": "android.view.View$PerformClick",
                                    "lineno": 19866,
                                    "native": False,
                                },
                                {
                                    "filename": "View.java",
                                    "function": "performClick",
                                    "module": "android.view.View",
                                    "lineno": 4780,
                                    "native": False,
                                },
                                {
                                    "filename": "ActionMenuItemView.java",
                                    "function": "onClick",
                                    "module": "androidx.appcompat.view.menu.ActionMenuItemView",
                                    "lineno": 7,
                                    "native": False,
                                },
                                {
                                    "filename": "ActionMenuView.java",
                                    "function": "invokeItem",
                                    "module": "androidx.appcompat.widget.ActionMenuView",
                                    "lineno": 4,
                                    "native": False,
                                },
                                {
                                    "filename": "MenuBuilder.java",
                                    "function": "performItemAction",
                                    "module": "androidx.appcompat.view.menu.MenuBuilder",
                                    "lineno": 1,
                                    "native": False,
                                },
                                {
                                    "filename": "MenuBuilder.java",
                                    "function": "performItemAction",
                                    "module": "androidx.appcompat.view.menu.MenuBuilder",
                                    "lineno": 4,
                                    "native": False,
                                },
                                {
                                    "filename": "MenuItemImpl.java",
                                    "function": "invoke",
                                    "module": "androidx.appcompat.view.menu.MenuItemImpl",
                                    "lineno": 15,
                                    "native": False,
                                },
                                {
                                    "filename": "MenuBuilder.java",
                                    "function": "dispatchMenuItemSelected",
                                    "module": "androidx.appcompat.view.menu.MenuBuilder",
                                    "lineno": 5,
                                    "native": False,
                                },
                                {
                                    "filename": "ActionMenuView.java",
                                    "function": "onMenuItemSelected",
                                    "module": "androidx.appcompat.widget.ActionMenuView$MenuBuilderCallback",
                                    "lineno": 7,
                                    "native": False,
                                },
                                {
                                    "filename": "Toolbar.java",
                                    "function": "onMenuItemClick",
                                    "module": "androidx.appcompat.widget.Toolbar$1",
                                    "lineno": 7,
                                    "native": False,
                                },
                                {
                                    "filename": "R8$$SyntheticClass",
                                    "function": "onMenuItemClick",
                                    "module": "io.sentry.samples.instrumentation.ui.g",
                                    "lineno": 40,
                                    "in_app": True,
                                    "native": False,
                                },
                            ]
                        },
                    }
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        if not self.use_relay():
            # We measure the number of queries after an initial post,
            # because there are many queries polluting the array
            # before the actual "processing" happens (like, auth_user)
            with self.assertWriteQueries(
                {
                    "nodestore_node": 2,
                    "sentry_eventuser": 1,
                    "sentry_groupedmessage": 1,
                    "sentry_userreport": 1,
                }
            ):
                self.post_and_retrieve_event(event_data)

        exc = event.interfaces["exception"].values[0]
        bt = exc.stacktrace
        frames = bt.frames

        assert exc.type == "RuntimeException"
        assert exc.value == "thrown on purpose to test ProGuard Android source context"
        assert exc.module == "java.lang"

        assert frames[18].function == "onMenuItemClick"
        assert (
            frames[18].module
            == "io.sentry.samples.instrumentation.ui.EditActivity$$InternalSyntheticLambda$1$ebaa538726b99bb77e0f5e7c86443911af17d6e5be2b8771952ae0caa4ff2ac7$0"
        )
        assert frames[18].lineno == 0
        assert frames[18].context_line is None
        assert frames[18].pre_context is None
        assert frames[18].post_context is None

        assert frames[19].function == "onCreate$lambda-1"
        assert frames[19].module == "io.sentry.samples.instrumentation.ui.EditActivity"
        assert frames[19].lineno == 37
        assert frames[19].context_line == "                    SomeService().helloThere()"
        assert frames[19].pre_context == [
            "        }",
            "",
            "        findViewById<Toolbar>(R.id.toolbar).setOnMenuItemClickListener {",
            "            if (it.itemId == R.id.action_save) {",
            "                try {",
        ]
        assert frames[19].post_context == [
            "                } catch (e: Exception) {",
            "                    Sentry.captureException(e)",
            "                }",
            "",
            "                val transaction = Sentry.startTransaction(",
        ]

        assert frames[20].function == "helloThere"
        assert frames[20].module == "io.sentry.samples.instrumentation.ui.SomeService"
        assert frames[20].lineno == 5
        assert frames[20].context_line == "        InnerClassOfSomeService().helloInner()"
        assert frames[20].pre_context == [
            "package io.sentry.samples.instrumentation.ui",
            "",
            "class SomeService {",
            "    fun helloThere() {",
        ]
        assert frames[20].post_context == [
            "    }",
            "",
            "    class InnerClassOfSomeService {",
            "        fun helloInner() {",
            "            AnotherClassInSameFile().helloOther()",
        ]

        assert frames[21].function == "helloInner"
        assert (
            frames[21].module
            == "io.sentry.samples.instrumentation.ui.SomeService$InnerClassOfSomeService"
        )
        assert frames[21].lineno == 10
        assert frames[21].context_line == "            AnotherClassInSameFile().helloOther()"
        assert frames[21].pre_context == [
            "        InnerClassOfSomeService().helloInner()",
            "    }",
            "",
            "    class InnerClassOfSomeService {",
            "        fun helloInner() {",
        ]
        assert frames[21].post_context == [
            "        }",
            "    }",
            "}",
            "",
            "class AnotherClassInSameFile {",
        ]

        assert frames[22].function == "helloOther"
        assert frames[22].module == "io.sentry.samples.instrumentation.ui.AnotherClassInSameFile"
        assert frames[22].lineno == 17
        assert frames[22].context_line is None
        assert frames[22].pre_context is None
        assert frames[22].post_context is None

        assert frames[23].function == "otherFun"
        assert frames[23].module == "io.sentry.samples.instrumentation.ui.AnotherClassInSameFile"
        assert frames[23].lineno == 21
        assert frames[23].context_line is None
        assert frames[23].pre_context is None
        assert frames[23].post_context is None

        assert frames[24].function == "helloOtherInner"
        assert (
            frames[24].module
            == "io.sentry.samples.instrumentation.ui.AnotherClassInSameFile$AnotherInnerClass"
        )
        assert frames[24].lineno == 26
        assert frames[24].context_line is None
        assert frames[24].pre_context is None
        assert frames[24].post_context is None

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_invalid_exception(self):
        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {},
            "exception": {
                "values": [
                    {"type": "PlatformException"},
                    {"type": "SecurityException", "module": "java.lang"},
                    {"type": "RemoteException", "module": "android.os"},
                ]
            },
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        expected = [
            {"type": e.get("type", None), "module": e.get("module", None)}
            for e in event_data["exception"]["values"]
        ]
        received = [
            {"type": e.type, "module": e.module} for e in event.interfaces["exception"].values
        ]

        assert received == expected

    def test_is_jvm_event(self):
        from sentry.lang.java.utils import is_jvm_event

        event = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "jvm", "debug_id": PROGUARD_INLINE_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "whoops4",
                                    "abs_path": "SourceFile",
                                    "module": "io.sentry.samples.MainActivity$OneMoreInnerClass",
                                    "filename": "SourceFile",
                                    "lineno": 38,
                                },
                            ]
                        },
                        "module": "io.sentry.samples",
                        "type": "RuntimeException",
                        "value": "whoops",
                    }
                ]
            },
            "timestamp": before_now(seconds=1),
        }

        stacktraces = find_stacktraces_in_data(event)
        assert is_jvm_event(event, stacktraces)

        event = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "debug_meta": {"images": [{"type": "jvm", "debug_id": PROGUARD_INLINE_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "whoops4",
                                    "abs_path": "SourceFile",
                                    "module": "io.sentry.samples.MainActivity$OneMoreInnerClass",
                                    "filename": "SourceFile",
                                    "lineno": 38,
                                },
                            ]
                        },
                        "module": "io.sentry.samples",
                        "type": "RuntimeException",
                        "value": "whoops",
                    }
                ]
            },
            "timestamp": before_now(seconds=1),
        }
        # has no platform
        stacktraces = find_stacktraces_in_data(event)
        assert is_jvm_event(event, stacktraces)

        event = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "whoops4",
                                    "abs_path": "SourceFile",
                                    "module": "io.sentry.samples.MainActivity$OneMoreInnerClass",
                                    "filename": "SourceFile",
                                    "lineno": 38,
                                },
                            ]
                        },
                        "module": "io.sentry.samples",
                        "type": "RuntimeException",
                        "value": "whoops",
                    }
                ]
            },
            "timestamp": before_now(seconds=1),
        }
        # has no modules
        stacktraces = find_stacktraces_in_data(event)
        assert is_jvm_event(event, stacktraces)

        event = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "debug_meta": {},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "platform": "java",
                                    "function": "whoops4",
                                    "abs_path": "SourceFile",
                                    "module": "io.sentry.samples.MainActivity$OneMoreInnerClass",
                                    "filename": "SourceFile",
                                    "lineno": 38,
                                },
                            ]
                        },
                        "module": "io.sentry.samples",
                        "type": "RuntimeException",
                        "value": "whoops",
                    }
                ]
            },
            "timestamp": before_now(seconds=1),
        }
        # has a Java frame
        stacktraces = find_stacktraces_in_data(event)
        assert is_jvm_event(event, stacktraces)

        event = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "debug_meta": {},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "whoops4",
                                    "abs_path": "SourceFile",
                                    "module": "io.sentry.samples.MainActivity$OneMoreInnerClass",
                                    "filename": "SourceFile",
                                    "lineno": 38,
                                },
                            ]
                        },
                        "module": "io.sentry.samples",
                        "type": "RuntimeException",
                        "value": "whoops",
                    }
                ]
            },
            "timestamp": before_now(seconds=1),
        }
        # has no platform, frame, or modules
        stacktraces = find_stacktraces_in_data(event)
        assert not is_jvm_event(event, stacktraces)
