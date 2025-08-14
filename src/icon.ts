import {
    Github,
    SettingTwo,
    Translation,
    Pic,
    CuttingOne,
    Moon,
    Export,
    PreviewOpen,
    DeleteOne,
    PlayOne,
    CheckSmall,
    ArrowRight,
    FolderOpen,
    Info,
    Upload,
    Download,
    BrowserSafari,
    TransferData,
    Refresh,
    ApplicationOne,
    Log
} from "@icon-park/vue-next";
import type { App } from "vue";

// 收集所有图标组件
const icons = {
    Github,
    SettingTwo,
    Translation,
    Pic,
    CuttingOne,
    Moon,
    Export,
    PreviewOpen,
    DeleteOne,
    PlayOne,
    CheckSmall,
    ArrowRight,
    FolderOpen,
    Info,
    Upload,
    Download,
    BrowserSafari,
    TransferData,
    Refresh,
    ApplicationOne,
    Log
};

// 创建插件
export default {
    install(app: App) {
        // 自动注册所有图标组件
        Object.entries(icons).forEach(([name, component]) => {
            app.component(name, component);
        });
    },
};
