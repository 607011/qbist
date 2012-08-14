/*
Idea and original code by Jörn Loviscach <jl@j3l7h.de>
Port to C++/JavaScript/Chrome Native Client and further modifications by Oliver Lau <oliver@von-und-fuer-lau.de>
$Id: qbist_www.h 87d3392f8cbf 2012/02/24 14:30:29 Oliver Lau <oliver@von-und-fuer-lau.de> $
*/

#ifndef __QBIST_WWW_H__
#define __QBIST_WWW_H__

#include <pthread.h>
#include <vector>
#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/graphics_2d.h"
#include "ppapi/cpp/image_data.h"
#include "ppapi/cpp/rect.h"
#include "ppapi/cpp/size.h"
#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/input_event.h"
#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/file_io.h"
#include "ppapi/cpp/file_ref.h"
#include "ppapi/cpp/file_system.h"
#include "colorspace.h"

typedef float real_t;

class QbistWwwInstance : public pp::Instance {
	static const int DEFAULT_NUM_THREADS = 4;

public:
	explicit QbistWwwInstance(PP_Instance instance);
	virtual ~QbistWwwInstance();

	virtual bool Init(uint32_t argc, const char* argn[], const char* argv[]);
	virtual void DidChangeView(const pp::Rect& position, const pp::Rect& clip);
	virtual bool HandleInputEvent(const pp::InputEvent& event);
	virtual void HandleMessage(const pp::Var& var_message);

	void setNumThreads(int);
	bool flushPending() const { return mFlushPending; }
	void setFlushPending(bool flag) { mFlushPending = flag; }

	const std::vector<int>& transform(void) const { return mTransform; }
	const std::vector<int>& source(void) const { return mSource; }
	const std::vector<int>& control(void) const { return mControl; }
	const std::vector<int>& dest(void) const { return mDest; }
	int regCount(void) const { return mRegCount; }
	pp::ImageData* pixelBuffer(void) { return mPixelBuffer; }
	bool doQuit(void) const { return mDoQuit; }
	int numTiles(void) const { return (int)mComputeThread.size(); }

private:
	static pp::Var makeMessage(std::string message);
	void CreateContext(const pp::Size& size);
	void DestroyContext(void);
	void FlushPixelBuffer(void);
	void Optimize(void);
	void Draw(void);
	bool IsContextValid() const { return mGraphics2DContext != NULL; }
	int width(void) const { return (mPixelBuffer != NULL)? mPixelBuffer->size().width()  : 0; }
	int height(void) const { return (mPixelBuffer != NULL)? mPixelBuffer->size().height() : 0; }
	pp::Graphics2D* mGraphics2DContext;
	pp::ImageData* mPixelBuffer;
	bool mFlushPending;
	int mVariation;
	std::vector<int> mTransform;
	std::vector<int> mSource;
	std::vector<int> mControl;
	std::vector<int> mDest;
	int mRegCount;
	struct ThreadParam {
		ThreadParam(void) : instance(NULL), id(-1) { /*...*/ }
		~ThreadParam() { /*...*/ }
		QbistWwwInstance* instance;
		int id;
	};
	std::vector<ThreadParam> mThreadParam;
	std::vector<pthread_t> mComputeThread;
	bool mDoQuit;
	static void* Compute(void* param);
};

#endif // __QBIST_WWW_H__
