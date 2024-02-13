import io
import logging

import aiohttp
import pyaudio
from pydub import AudioSegment

logger = logging.getLogger("danmaku")


class AudioPlayer:
    def __init__(self):
        self.pyaudio_instance = pyaudio.PyAudio()
        self.device_name = ""
        # device_index = -1
        default_device_info = self.pyaudio_instance.get_default_output_device_info()
        device_index = default_device_info['index']
        # device_info = self.pyaudio_instance.get_device_info_by_index(device_index)
        # self.device_name = device_info['name']
        logger.info(f"使用音频设备：{device_index} {self.device_name}")
        assert device_index != -1, "找不到音频设备"
        self.device_index = device_index
        self.stream = None

    def open_stream(self, sample_rate, channels, sample_width):
        if self.stream is not None:
            self.close_stream()
        self.stream = self.pyaudio_instance.open(
            format=self.pyaudio_instance.get_format_from_width(sample_width),
            channels=channels,
            rate=sample_rate,
            output=True,
            output_device_index=self.device_index
        )

    def play(self, audio_data):
        if self.stream is not None:
            self.stream.write(audio_data)
        else:
            raise RuntimeError("Audio stream is not open")

    async def play_online_wav(self, wav_url):
        async with aiohttp.ClientSession() as s:
            async with s.get(wav_url) as resp:
                if resp.status != 200:
                    logger.error(f"音频下载失败，状态码：{resp.status}")
                    return
                try:
                    data = await resp.read()
                    audio = AudioSegment.from_file(io.BytesIO(data), format="wav")
                    # 确保音频流已经打开
                    self.open_stream(audio.frame_rate, audio.channels, audio.sample_width)
                    # 播放音频
                    self.play(audio.raw_data)

                except Exception as e:
                    logger.error(f"播放音频失败，error: {e}")
                    return

    def close_stream(self):
        if self.stream is not None:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None

    # def __del__(self):
    #     if self.stream is not None:
    #         self.close_stream()
    #     self.pyaudio_instance.terminate()


# logger = logging.getLogger("danmaku")
gAudioPlayer = AudioPlayer()


async def predict(url: str, voice_name: str, text: str):
    predict_url = f"{url}run/predict"
    data = {
        "data": [
            text,
            voice_name,
            0.5,
            0.6,
            0.9,
            1,
            "auto",
            None,
            "Happy",
            "Text prompt",
            "",
            0.7
        ],
        "event_data": None,
        "fn_index": 0
    }
    async with aiohttp.ClientSession() as s:
        async with s.post(predict_url, json=data) as resp:
            if resp.status != 200:
                logger.error(f"请求失败，状态码：{resp.status} text: {text}")
                return
            ret = await resp.json()
            if "data" not in ret:
                logger.error(f"返回数据格式错误，text:{text} ret: {ret}")
                return
            wav_url = f'{url}file={ret["data"][1]["name"]}'
            # wav_url = ""
            # try:
            #     wav_url = f'{url}file={ret["data"][1]["path"]}'
            #
            # except Exception as e:
            #     logger.error(f"路径格式化错误{wav_url}")

            await gAudioPlayer.play_online_wav(wav_url)
