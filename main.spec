# -*- mode: python ; coding: utf-8 -*-
# 该文件用于把项目打包成exe文件
# 修改SUPER_DIR 为 自己blivechat 所在文件夹目录
SUPER_DIR = 'E:\\Program\\python\\Code\\bilibili\\blivechat'

a = Analysis(
    ['main.py',
	SUPER_DIR+'\\api\\base.py',
	SUPER_DIR+'\\api\\chat.py',
	SUPER_DIR+'\\api\\main.py',
	SUPER_DIR+'\\api\\open_live.py',
	SUPER_DIR+'\\api\\plugin.py',
	SUPER_DIR+'\\blcsdk\\__init__.py',
	SUPER_DIR+'\\blcsdk\\api.py',
	SUPER_DIR+'\\blcsdk\\client.py',
	SUPER_DIR+'\\blcsdk\\exc.py',
	SUPER_DIR+'\\blcsdk\\handlers.py',
	SUPER_DIR+'\\blcsdk\\models.py',
	SUPER_DIR+'\\plugins\\msg-logging\\listener.py',
	SUPER_DIR+'\\plugins\\msg-logging\\main.py',
    SUPER_DIR+'\\services\\avatar.py',
	SUPER_DIR+'\\services\\chat.py',
	SUPER_DIR+'\\services\\plugin.py',
	SUPER_DIR+'\\services\\translate.py',
    SUPER_DIR+'\\utils\\request.py',
    'config.py',
    'update.py'],
    pathex=[SUPER_DIR+''],
    binaries=[],
    datas=[(SUPER_DIR+'\\data','data'),
    (SUPER_DIR+'\\frontend','frontend'),
    (SUPER_DIR+'\\log','log')],
    hiddenimports=[SUPER_DIR,'aiohttp','Brotli','pure-protobuf','yarl','cachetools','pycryptodome','sqlalchemy','tornado'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='blivechat',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=SUPER_DIR+'\\favicon.ico',
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='blivechat',
)
