/*
Idea and original code for QbistWwwInstance::Compute() by Jörn Loviscach <jl@j3l7h.de>
Port to C++ and optimizations by Oliver Lau <oliver@von-und-fuer-lau.de>
Copyright (c) 1995, 2012 by Jörn Loviscach & Oliver Lau. All rights reserved.
$Id: qbist_www.cc 87d3392f8cbf 2012/02/24 14:30:29 Oliver Lau <oliver@von-und-fuer-lau.de> $
*/

#include <cstdio>
#include <iostream>
#include <string>
#include <sstream>
#include <deque>
#include "qbist_www.h"

using namespace qbist;

namespace AsyncCallbacks {

	void FlushCallback(void* data, int32_t result) {
		static_cast<QbistWwwInstance*>(data)->setFlushPending(false);
	}

}


QbistWwwInstance::QbistWwwInstance(PP_Instance instance)
		: pp::Instance(instance)
		, mGraphics2DContext(NULL)
		, mPixelBuffer(NULL)
		, mFlushPending(false)
		, mVariation(-1)
		, mRegCount(6)
		, mThreadParam(DEFAULT_NUM_THREADS)
		, mComputeThread(DEFAULT_NUM_THREADS)
		, mDoQuit(false)
{ 
	RequestInputEvents(PP_INPUTEVENT_CLASS_MOUSE | PP_INPUTEVENT_CLASS_KEYBOARD);
}


QbistWwwInstance::~QbistWwwInstance()
{
	mDoQuit = true;
	for (unsigned int i = 0; i < mComputeThread.size(); ++i)
		pthread_join(mComputeThread[i], NULL);
	DestroyContext();
	if (mPixelBuffer)
		delete mPixelBuffer;
}


pp::Var QbistWwwInstance::makeMessage(std::string message) {
	std::stringstream reply;
	reply << "{\"message\": \"" << message << "\"}";
	return pp::Var(reply.str());
}


bool QbistWwwInstance::Init(uint32_t argc, const char* argn[], const char* argv[]) {
	//for (uint32_t i = 0; i < argc; ++i) {
	//	std::string attribute(argn[i]);
	//	std::string value(argv[i]);
	//}
	return true;
}


void QbistWwwInstance::DidChangeView(const pp::Rect& position, const pp::Rect& clip) {
	if (position.size().width() == width() && position.size().height() == height())
		return;
	DestroyContext();
	CreateContext(position.size());
	delete mPixelBuffer;
	mPixelBuffer = (mGraphics2DContext != NULL)
		? new pp::ImageData(this, PP_IMAGEDATAFORMAT_BGRA_PREMUL, mGraphics2DContext->size(), false)
		: NULL;
}


bool QbistWwwInstance::HandleInputEvent(const pp::InputEvent& event) {
	if (event.GetType() == PP_INPUTEVENT_TYPE_MOUSEUP) {
		std::stringstream reply;
		reply << "{"
			<< "\"message\": \"click\"," 
			<< "\"variation\": " << mVariation
			<< "}";
		PostMessage(pp::Var(reply.str()));
		return true;
	}
	return false;
}


void QbistWwwInstance::CreateContext(const pp::Size& size) {
	if (IsContextValid())
		return;
	mGraphics2DContext = new pp::Graphics2D(this, size, false);
	if (!BindGraphics(*mGraphics2DContext))
		std::cout << "[FATAL] Couldn't bind the device context." << std::endl;
}


void QbistWwwInstance::DestroyContext() {
	if (!IsContextValid())
		return;
	delete mGraphics2DContext;
	mGraphics2DContext = NULL;
}


void QbistWwwInstance::FlushPixelBuffer() {
	if (!IsContextValid())
		return;
	mGraphics2DContext->PaintImageData(*mPixelBuffer, pp::Point());
	if (flushPending())
		return;
	setFlushPending(true);
	mGraphics2DContext->Flush(pp::CompletionCallback(&AsyncCallbacks::FlushCallback, this));
}


void QbistWwwInstance::setNumThreads(int n)
{
	mThreadParam.resize(n);
	mComputeThread.resize(n);
}


static inline void addConditionally(std::deque<int>& trx, std::deque<int>& dst, std::deque<int>& src, std::deque<int>& ctl, 
									int t, int d, int s, int c, std::vector<int>& sources, std::vector<bool>& needed)
{
    if (needed.at(d)) {
		trx.push_front(t);
        dst.push_front(d);
        src.push_front(s);
        ctl.push_front(c);
        needed[d] = false;
        for (unsigned int i = 0; i < sources.size(); ++i)
            needed[sources.at(i)] = true;
    }
}


void QbistWwwInstance::Optimize(void)
{
	std::deque<int> trx, dst, src, ctl;
	std::vector<bool> needed(mRegCount);
	needed[0] = true;
	for (unsigned int i = 1; i < needed.size(); ++i)
		needed[i] = false;
	int i = mTransform.size();
	while (i--) {
        int t = mTransform[i];
        int d = mDest[i];
        int s = mSource[i];
        int c = mControl[i];
        switch (t)
        {
        case 0: // fall-through
        case 1: // fall-through
        case 2: // fall-through
        case 5: // fall-through
        case 6: // fall-through
        case 7:
			{
				std::vector<int> sources(2);
				sources[0] = s;
				sources[1] = c;
				addConditionally(trx, dst, src, ctl, t, d, s, c, sources, needed);
			}
			break;
        case 3: // fall-through
        case 4: // fall-through
		case 8:
			{
				std::vector<int> sources(1);
				sources[0] = s;
				addConditionally(trx, dst, src, ctl, t, d, s, c, sources, needed);
			}
			break;
        default: // ignore
			break;
        }
	};
	mTransform.clear();
	for (std::deque<int>::iterator i = trx.begin(); i != trx.end(); ++i)
		mTransform.push_back(*i);
	mDest.clear();
	for (std::deque<int>::iterator i = dst.begin(); i != dst.end(); ++i)
		mDest.push_back(*i);
	mSource.clear();
	for (std::deque<int>::iterator i = src.begin(); i != src.end(); ++i)
		mSource.push_back(*i);
	mControl.clear();
	for (std::deque<int>::iterator i = ctl.begin(); i != ctl.end(); ++i)
		mControl.push_back(*i);
}


void* QbistWwwInstance::Compute(void* param) {
	ThreadParam* p = static_cast<ThreadParam*>(param);
	const std::vector<int>& trx = p->instance->transform();
	const std::vector<int>& src = p->instance->source();
	const std::vector<int>& ctl = p->instance->control();
	const std::vector<int>& dst = p->instance->dest();
	unsigned int lastTransform = dst.size();
	while (dst[--lastTransform] != 0 && lastTransform >= 0); // Optimierung: Danke, bo!
	++lastTransform;
	const int w = p->instance->width();
	const int h = p->instance->height();
	const int H = h / p->instance->numTiles();
	const int Y0 = p->id * H;
	const int Y1 = Y0 + H;
	const int offset = w * Y0;
	uint32_t* pixel_bits = reinterpret_cast<uint32_t*>(p->instance->pixelBuffer()->data()) + offset;
	std::vector<qbist::Colorspace<real_t> > reg(p->instance->regCount());
	for (int y = Y0; y < Y1 && !p->instance->doQuit(); ++y) {
		const real_t yreal = (real_t)y / h;
		for (int x = 0; x < w; ++x) {
			const real_t xreal = (real_t)x / w;
			for (unsigned int j = 0; j < reg.size(); ++j)
				reg[j].set(xreal, yreal, (real_t)j / reg.size());
			for (unsigned int i = 0; i < lastTransform; ++i) {
				switch (trx[i])
				{
				case 0: reg[dst[i]].project(reg[src[i]], reg[ctl[i]]); break;
				case 1: reg[dst[i]].shift(reg[src[i]], reg[ctl[i]]); break;
				case 2: reg[dst[i]].shiftBack(reg[src[i]], reg[ctl[i]]); break;
				case 3: reg[dst[i]].rotate(reg[src[i]]); break;
				case 4: reg[dst[i]].rotate2(reg[src[i]]); break;
				case 5: reg[dst[i]].multiply(reg[src[i]], reg[ctl[i]]); break;
				case 6: reg[dst[i]].sine(reg[src[i]], reg[ctl[i]]); break;
				case 7: reg[dst[i]].conditional(reg[src[i]], reg[ctl[i]]); break;
				case 8: reg[dst[i]].complement(reg[src[i]]); break;
				default: break;
				}
			}
			*pixel_bits++ = reg[0].rgb();
		}
	}
	return NULL;
}


void QbistWwwInstance::Draw(void) {
	for (unsigned int i = 0; i < mComputeThread.size(); ++i) {
		mThreadParam[i].id = i;
		mThreadParam[i].instance = this;
		pthread_create(&mComputeThread[i], NULL, QbistWwwInstance::Compute, (void*)&mThreadParam[i]);
	}
	for (unsigned int i = 0; i < mComputeThread.size(); ++i) {
		pthread_join(mComputeThread[i], NULL);
	}
}


/*
void QbistWwwInstance::postPixelBuffer(int variation)
{
	const unsigned char * pixel_bits = reinterpret_cast<const unsigned char*>(mPixelBuffer->data());
	std::stringstream reply;
	reply << "{"
		<< " \"message\": \"data\"," 
		<< " \"variation\": " << variation << ","
		<< " \"data\": \"" << base64_encode(pixel_bits, width() * height() * 4) << "\""
		<< " }";
	std::cout << reply.str() << std::endl;
	PostMessage(pp::Var(reply.str()));
}
*/
